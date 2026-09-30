import os
import sys
import time
import boto3
import asyncio
import traceback
import subprocess
import faster_whisper
from datetime import datetime, timezone
from fastapi import FastAPI
from supabase import create_client, Client

app = FastAPI()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

R2_ACCOUNT_ID = os.environ.get("R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY")
R2_BUCKET = os.environ.get("R2_BUCKET", "motion-subtitle-media")

# ---------------------------------------------------------------------------
# Supabase client
# ---------------------------------------------------------------------------
supabase: Client = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
else:
    print("[HF-Worker] WARNING: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set.", file=sys.stderr)

# ---------------------------------------------------------------------------
# R2 / boto3 client
# ---------------------------------------------------------------------------
s3_client = None
if R2_ACCOUNT_ID and R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY:
    s3_client = boto3.client(
        's3',
        endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        region_name="auto"
    )
else:
    print("[HF-Worker] WARNING: R2 credentials not set.", file=sys.stderr)

# ---------------------------------------------------------------------------
# FIX #3: Model is loaded ONCE at process startup and stays warm.
# Exact production spec: tiny / cpu / int8 / cpu_threads=4 / num_workers=2
# (matches server/transcribe_daemon.py exactly)
# The model weights are baked into the Docker image; this call loads from disk.
# ---------------------------------------------------------------------------
MODEL_READY = False
model = None

print("[HF-Worker] Loading faster-whisper tiny model (int8, cpu)...", file=sys.stderr)
try:
    model = faster_whisper.WhisperModel(
        "tiny",
        device="cpu",
        compute_type="int8",
        cpu_threads=4,
        num_workers=2
    )
    MODEL_READY = True
    print("[HF-Worker] Model loaded successfully. Worker is ready.", file=sys.stderr)
except Exception as _model_err:
    # FIX #1: Do NOT set model = None silently. Log clearly and keep MODEL_READY False
    # so the polling daemon refuses to claim jobs without crashing.
    print(f"[HF-Worker] CRITICAL: faster-whisper model failed to load: {_model_err}", file=sys.stderr)
    traceback.print_exc(file=sys.stderr)
    print("[HF-Worker] Polling daemon will NOT claim jobs until model is available.", file=sys.stderr)


# ---------------------------------------------------------------------------
# FIX #2 helper: normalise words to EXACTLY match the production schema
# produced by server/transcription.js normalizeToWords():
#   { id: "w{index}", text: "...", start: float, end: float, index: int }
# Empty tokens are skipped (same as production).
# ---------------------------------------------------------------------------
def normalize_words(segments_iter):
    """Consume faster-whisper segment iterator and return production-schema word list."""
    words = []
    global_index = 0
    for segment in segments_iter:
        if not segment.words:
            continue
        for w in segment.words:
            text = (w.word or "").strip()
            if not text:          # skip empty tokens — matches production behaviour
                continue
            words.append({
                "id": f"w{global_index}",   # "w0", "w1", ... — exact production format
                "text": text,               # "text" key — exact production field name
                "start": w.start,
                "end": w.end,
                "index": global_index,
            })
            global_index += 1
    return words


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# HTTP endpoints — keep-alive pings only; no credentials exposed
# ---------------------------------------------------------------------------
@app.get("/")
def read_root():
    return {
        "status": "ok",
        "model_ready": MODEL_READY,
        "message": "Hugging Face Transcription Worker is running.",
    }

@app.get("/health")
def health_check():
    return {"status": "healthy", "model_ready": MODEL_READY, "version": "v4_pinned"}


# ---------------------------------------------------------------------------
# Core job processor
# ---------------------------------------------------------------------------
async def process_job(project: dict):
    project_id = project["id"]
    tmp_video = None
    tmp_audio = None

    # FIX #1: Guard — never attempt to process if model failed to load.
    if not MODEL_READY or model is None:
        print(
            f"[HF-Worker] SKIPPING project {project_id}: model is not ready. "
            "Check startup logs for initialization error.",
            file=sys.stderr,
        )
        return  # Leave the row in QUEUED_RENDER_TRANS so GHA fallback can pick it up.

    try:
        # --- Atomic claim (single SQL UPDATE WHERE — safe against concurrent workers) ---
        claim_res = (
            supabase.table("projects")
            .update({"status": "TRANSCRIBING", "updated_at": utc_now()})
            .eq("id", project_id)
            .eq("status", "QUEUED_RENDER_TRANS")
            .execute()
        )

        if not claim_res.data:
            # Row was already claimed by another worker (GHA or another HF instance).
            print(f"[HF-Worker] Project {project_id} already claimed — skipping.", file=sys.stderr)
            return

        print(f"[HF-Worker] Claimed project {project_id}.", file=sys.stderr)

        # --- Determine R2 key ---
        videos = project.get("videos") or {}
        b2_key = videos.get("storage_path") or project.get("video_id")
        if not b2_key:
            raise RuntimeError("No video storage_path or video_id found on project row.")

        # --- Download video from R2 ---
        # Use AWS SDK (boto3) download — same safe approach as github-worker.js.
        tmp_video = f"/tmp/hfw-video-{project_id}.mp4"
        tmp_audio = f"/tmp/hfw-audio-{project_id}.wav"

        print(f"[HF-Worker] Downloading R2 key '{b2_key}' to {tmp_video}...", file=sys.stderr)
        s3_client.download_file(R2_BUCKET, b2_key, tmp_video)

        # --- Extract 16 kHz mono audio (same params as transcription.js) ---
        print(f"[HF-Worker] Extracting audio to {tmp_audio}...", file=sys.stderr)
        t_audio_start = time.monotonic()
        result = subprocess.run(
            [
                "ffmpeg", "-i", tmp_video,
                "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le",
                tmp_audio, "-y",
            ],
            capture_output=True,
        )
        if result.returncode != 0:
            raise RuntimeError(
                f"FFmpeg failed (exit {result.returncode}): "
                + result.stderr.decode(errors="replace")[-500:]
            )
        audio_ext_ms = (time.monotonic() - t_audio_start) * 1000
        print(f"[HF-Worker] Audio extraction: {audio_ext_ms:.0f}ms", file=sys.stderr)

        # --- Determine language (Auto-Detect if not set or "auto") ---
        segments_meta = project.get("segments") or {}
        if isinstance(segments_meta, list):
            segments_meta = {}
        meta = segments_meta.get("_meta") or {}
        language = meta.get("language") or "auto"

        transcribe_args = {
            "word_timestamps": True,
            "beam_size": 1,
            "vad_filter": True,
            "vad_parameters": {"min_silence_duration_ms": 500},
            "condition_on_previous_text": False,
        }
        if language and language.lower() != "auto":
            transcribe_args["language"] = language

        print(
            f"[HF-Worker] Transcribing (lang={language}, word_timestamps=True)...",
            file=sys.stderr,
        )
        t_whisper_start = time.monotonic()
        segments_iter, info = model.transcribe(tmp_audio, **transcribe_args)

        # FIX #2: Normalise to EXACT production word schema.
        words_raw = normalize_words(segments_iter)
        whisper_ms = (time.monotonic() - t_whisper_start) * 1000

        print(
            f"[HF-Worker] Whisper done: {whisper_ms:.0f}ms, {len(words_raw)} words, "
            f"detected_lang={info.language} (prob={info.language_probability:.2f})",
            file=sys.stderr,
        )

        # --- Save transcript (upsert into transcripts table) ---
        tr_res = (
            supabase.table("transcripts")
            .select("id")
            .eq("project_id", project_id)
            .execute()
        )
        if tr_res.data:
            supabase.table("transcripts").update({"words": words_raw}).eq(
                "id", tr_res.data[0]["id"]
            ).execute()
        else:
            supabase.table("transcripts").insert(
                {"project_id": project_id, "words": words_raw}
            ).execute()

        # --- Update project status (preserve existing _meta, update language/metrics) ---
        proj_res = (
            supabase.table("projects")
            .select("segments")
            .eq("id", project_id)
            .single()
            .execute()
        )
        seg_obj = proj_res.data.get("segments") if proj_res.data else None
        if not seg_obj or isinstance(seg_obj, list):
            seg_obj = {"_meta": {}}
        if not seg_obj.get("_meta"):
            seg_obj["_meta"] = {}

        seg_obj["_meta"]["language"] = info.language
        seg_obj["_meta"]["metrics"] = {
            "hf_worker": True,
            "audioExtTime": round(audio_ext_ms),
            "whisperTime": round(whisper_ms),
        }

        supabase.table("projects").update({
            "status": "TRANSCRIBED",
            "segments": seg_obj,
            "updated_at": utc_now(),
        }).eq("id", project_id).execute()

        print(f"[HF-Worker] Project {project_id} → TRANSCRIBED ✓", file=sys.stderr)

    except Exception as exc:
        print(f"[HF-Worker] ERROR processing {project_id}: {exc}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        try:
            # Mark FAILED so GHA fallback can pick it up.
            err_str = str(exc)
            supabase.table("projects").update({
                "status": "FAILED",
                "segments": {"_meta": {"error": err_str}},
                "updated_at": utc_now(),
            }).eq("id", project_id).execute()
        except Exception as supabase_err:
            print(f"[HF-Worker] Failed to mark project FAILED: {supabase_err}", file=sys.stderr)

    finally:
        # Always clean up temp files — runs on both success AND failure.
        for tmp_path in (tmp_video, tmp_audio):
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass


# ---------------------------------------------------------------------------
# Polling daemon — runs as a background asyncio task
# ---------------------------------------------------------------------------
async def polling_daemon():
    if not supabase:
        print(
            "[HF-Worker] Supabase client unavailable — polling disabled. "
            "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
            file=sys.stderr,
        )
        return
    if not s3_client:
        print(
            "[HF-Worker] R2/boto3 client unavailable — polling disabled. "
            "Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.",
            file=sys.stderr,
        )
        return

    print("[HF-Worker] Polling daemon started (interval=3s).", file=sys.stderr)
    while True:
        try:
            res = (
                supabase.table("projects")
                .select("*, videos!projects_video_id_fkey(storage_path)")
                .eq("status", "QUEUED_RENDER_TRANS")
                .execute()
            )
            if res.data:
                for proj in res.data:
                    await process_job(proj)
        except Exception as poll_err:
            print(f"[HF-Worker] Polling error: {poll_err}", file=sys.stderr)

        await asyncio.sleep(3)


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(polling_daemon())


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)

import os
import sys
import time
import boto3
import asyncio
import traceback
import subprocess
import numpy as np
from scipy.io import wavfile

import faster_whisper
from datetime import datetime, timezone, timedelta
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
# Reliability config — transcription must never wedge or silently die.
# ---------------------------------------------------------------------------
MAX_ATTEMPTS = 3               # total tries before a job is marked FAILED
HEARTBEAT_INTERVAL_S = 30      # touch updated_at this often while TRANSCRIBING
STALE_HEARTBEAT_S = 180        # reaper: TRANSCRIBING rows older than this get requeued
DOWNLOAD_TIMEOUT_S = 300       # 5 min per R2 download
FFMPEG_TIMEOUT_S = 300         # 5 min for audio extraction
TRANSCRIBE_TIMEOUT_S = 1800    # 30 min — pathological audio fails fast, not forever
MAX_CONCURRENT_JOBS = 2        # bound concurrency; one hung job can't wedge everyone

_job_semaphore = asyncio.Semaphore(MAX_CONCURRENT_JOBS)

# Substrings that mark an error as transient (worth an automatic retry).
TRANSIENT_MARKERS = (
    "connection", "timeout", "timed out", "temporary", "try again",
    "503", "502", "504", "500", "slowdown", "internalerror",
    "network", "econnreset", "econnaborted", "socket", "broken pipe",
)


def is_transient(exc: Exception) -> bool:
    msg = f"{type(exc).__name__}: {exc}".lower()
    return any(m in msg for m in TRANSIENT_MARKERS)


def get_attempts(project: dict) -> int:
    """Read the retry counter from segments._meta (0 if absent)."""
    try:
        segs = project.get("segments") or {}
        if isinstance(segs, list):
            return 0
        return int((segs.get("_meta") or {}).get("attempts", 0) or 0)
    except Exception:
        return 0


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
# Model is loaded ONCE at process startup and stays warm.
# Production spec: base / cpu / int8 / cpu_threads=4 / num_workers=2
# (matches server/transcribe_daemon.py)
# The model weights are baked into the Docker image; this call loads from disk.
# ---------------------------------------------------------------------------
MODEL_READY = False
model = None
global_model_load_ms = 0

print("[HF-Worker] Loading faster-whisper base model (int8, cpu)...", file=sys.stderr)
try:
    t_model_start = time.monotonic()
    model = faster_whisper.WhisperModel(
        "base",
        device="cpu",
        compute_type="int8",
        cpu_threads=4,
        num_workers=2
    )
    global_model_load_ms = (time.monotonic() - t_model_start) * 1000
    MODEL_READY = True
    print(f"[HF-Worker] Model loaded successfully in {global_model_load_ms:.0f}ms. Worker is ready.", file=sys.stderr)
except Exception as _model_err:
    # Do NOT set model = None silently. Log clearly and keep MODEL_READY False
    # so the polling daemon refuses to claim jobs without crashing.
    print(f"[HF-Worker] CRITICAL: faster-whisper model failed to load: {_model_err}", file=sys.stderr)
    traceback.print_exc(file=sys.stderr)
    print("[HF-Worker] Polling daemon will NOT claim jobs until model is available.", file=sys.stderr)


# ---------------------------------------------------------------------------
# Helper: normalise words to EXACTLY match the production schema
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
    return {"status": "healthy", "model_ready": MODEL_READY, "version": "v6_reliable"}


# ---------------------------------------------------------------------------
# Heartbeat — proves a TRANSCRIBING job is still alive.
# ---------------------------------------------------------------------------
async def heartbeat_loop(project_id: str, stop_event: asyncio.Event):
    while not stop_event.is_set():
        try:
            await asyncio.to_thread(
                lambda: supabase.table("projects")
                    .update({"updated_at": utc_now()})
                    .eq("id", project_id)
                    .eq("status", "TRANSCRIBING")
                    .execute()
            )
        except Exception as hb_err:
            print(f"[HF-Worker] Heartbeat failed for {project_id}: {hb_err}", file=sys.stderr)
        await asyncio.sleep(HEARTBEAT_INTERVAL_S)


# ---------------------------------------------------------------------------
# Reaper — requeue TRANSCRIBING rows whose heartbeat went stale
# (worker died mid-job: OOM, restart, redeploy). Crash loops are capped
# by the attempts counter; hopeless jobs go FAILED instead of spinning forever.
# ---------------------------------------------------------------------------
async def reap_stale_jobs():
    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(seconds=STALE_HEARTBEAT_S)).isoformat()
        res = await asyncio.to_thread(
            lambda: supabase.table("projects")
                .select("id, segments")
                .eq("status", "TRANSCRIBING")
                .lt("updated_at", cutoff)
                .execute()
        )
        for row in res.data or []:
            attempts = get_attempts(row) + 1  # this crash counts as an attempt
            try:
                seg_obj = row.get("segments")
                if not seg_obj or isinstance(seg_obj, list):
                    seg_obj = {"_meta": {}}
                if not seg_obj.get("_meta"):
                    seg_obj["_meta"] = {}
                seg_obj["_meta"]["attempts"] = attempts

                if attempts >= MAX_ATTEMPTS:
                    await asyncio.to_thread(
                        lambda r=row, s=seg_obj: supabase.table("projects").update({
                            "status": "FAILED",
                            "segments": s,
                            "updated_at": utc_now(),
                        }).eq("id", r["id"]).eq("status", "TRANSCRIBING").execute()
                    )
                    print(f"[HF-Worker] Reaper: {row['id']} hit {MAX_ATTEMPTS} attempts → FAILED", file=sys.stderr)
                else:
                    await asyncio.to_thread(
                        lambda r=row, s=seg_obj: supabase.table("projects").update({
                            "status": "QUEUED_RENDER_TRANS",
                            "segments": s,
                            "updated_at": utc_now(),
                        }).eq("id", r["id"]).eq("status", "TRANSCRIBING").execute()
                    )
                    print(f"[HF-Worker] Reaper: requeued stale job {row['id']} (attempt {attempts}/{MAX_ATTEMPTS})", file=sys.stderr)
            except Exception as row_err:
                print(f"[HF-Worker] Reaper: failed to handle {row.get('id')}: {row_err}", file=sys.stderr)
    except Exception as reap_err:
        print(f"[HF-Worker] Reaper error: {reap_err}", file=sys.stderr)


async def fetch_queued():
    """Fetch queued jobs; fall back to a join-free query if the FK name drifts."""
    try:
        return await asyncio.to_thread(
            lambda: supabase.table("projects")
                .select("*, videos!projects_video_id_fkey(storage_path)")
                .eq("status", "QUEUED_RENDER_TRANS")
                .execute()
        )
    except Exception as join_err:
        print(f"[HF-Worker] Join query failed ({join_err}); retrying without videos join.", file=sys.stderr)
        return await asyncio.to_thread(
            lambda: supabase.table("projects")
                .select("*")
                .eq("status", "QUEUED_RENDER_TRANS")
                .execute()
        )


# ---------------------------------------------------------------------------
# Core job processor
# ---------------------------------------------------------------------------
async def process_job(project: dict):
    project_id = project["id"]
    tmp_video = None
    tmp_audio = None
    abandoned = False  # set when a stage times out; orphaned threads must not write

    # Guard — never attempt to process if model failed to load.
    if not MODEL_READY or model is None:
        print(
            f"[HF-Worker] SKIPPING project {project_id}: model is not ready. "
            "Check startup logs for initialization error.",
            file=sys.stderr,
        )
        return  # Leave the row queued; it will be picked up once the model is ready.

    t_total_start = time.monotonic()

    queued_at = project.get("updated_at") or project.get("created_at")
    wake_time_ms = 0
    if queued_at:
        try:
            q_dt = datetime.fromisoformat(queued_at.replace("Z", "+00:00"))
            wake_time_ms = (datetime.now(timezone.utc) - q_dt).total_seconds() * 1000
        except Exception:
            pass

    stop_hb = asyncio.Event()
    hb_task = None

    def conditional_update(values: dict) -> bool:
        """Write only if this job still owns the row (still TRANSCRIBING)."""
        if abandoned:
            return False
        res = supabase.table("projects").update(values).eq("id", project_id).eq("status", "TRANSCRIBING").execute()
        return bool(res.data)

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
            # Row was already claimed by another worker instance.
            print(f"[HF-Worker] Project {project_id} already claimed — skipping.", file=sys.stderr)
            return

        print(f"[HF-Worker] Claimed project {project_id}.", file=sys.stderr)

        # --- Start heartbeat: proves liveness until the job finishes ---
        hb_task = asyncio.create_task(heartbeat_loop(project_id, stop_hb))

        # --- Determine R2 key ---
        videos = project.get("videos") or {}
        b2_key = videos.get("storage_path") or project.get("video_id")
        if not b2_key:
            raise RuntimeError("No video storage_path or video_id found on project row.")

        # --- Download video from R2 (bounded: a stalled download can't wedge the worker) ---
        tmp_video = f"/tmp/hfw-video-{project_id}.mp4"
        tmp_audio = f"/tmp/hfw-audio-{project_id}.wav"

        print(f"[HF-Worker] Downloading R2 key '{b2_key}' to {tmp_video}...", file=sys.stderr)
        t_dl_start = time.monotonic()
        try:
            await asyncio.wait_for(
                asyncio.to_thread(s3_client.download_file, R2_BUCKET, b2_key, tmp_video),
                timeout=DOWNLOAD_TIMEOUT_S,
            )
        except asyncio.TimeoutError:
            abandoned = True
            raise RuntimeError(f"R2 download timed out after {DOWNLOAD_TIMEOUT_S}s")
        dl_ms = (time.monotonic() - t_dl_start) * 1000

        # --- Extract 16 kHz mono audio (same params as transcription.js) ---
        print(f"[HF-Worker] Extracting audio to {tmp_audio}...", file=sys.stderr)
        t_audio_start = time.monotonic()

        def _run_ffmpeg():
            return subprocess.run(
                [
                    "ffmpeg", "-i", tmp_video,
                    "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le",
                    tmp_audio, "-y",
                ],
                capture_output=True,
                timeout=FFMPEG_TIMEOUT_S,
            )

        try:
            result = await asyncio.to_thread(_run_ffmpeg)
        except subprocess.TimeoutExpired:
            abandoned = True
            raise RuntimeError(f"FFmpeg audio extraction timed out after {FFMPEG_TIMEOUT_S}s")
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
            "beam_size": 5,
            "condition_on_previous_text": True,
        }
        if language and language.lower() != "auto":
            transcribe_args["language"] = language

        print(
            f"[HF-Worker] Transcribing (lang={language}, word_timestamps=True)...",
            file=sys.stderr,
        )
        t_whisper_start = time.monotonic()

        def _read_wav():
            sample_rate, data = wavfile.read(tmp_audio)
            if data.dtype != np.float32:
                data = data.astype(np.float32) / 32768.0
            return data

        try:
            data = await asyncio.to_thread(_read_wav)
        except Exception as e:
            print(f"[HF-Worker] Error reading WAV: {e}", file=sys.stderr)
            raise

        def _run_transcribe():
            segments_iter, info = model.transcribe(data, **transcribe_args)
            # Consume the generator here so the timeout covers full inference.
            words = normalize_words(segments_iter)
            return words, info

        try:
            words_raw, info = await asyncio.wait_for(
                asyncio.to_thread(_run_transcribe),
                timeout=TRANSCRIBE_TIMEOUT_S,
            )
        except asyncio.TimeoutError:
            abandoned = True
            raise RuntimeError(f"Whisper inference timed out after {TRANSCRIBE_TIMEOUT_S}s")
        whisper_ms = (time.monotonic() - t_whisper_start) * 1000

        print(
            f"[HF-Worker] Whisper done: {whisper_ms:.0f}ms, {len(words_raw)} words, "
            f"detected_lang={info.language} (prob={info.language_probability:.2f})",
            file=sys.stderr,
        )

        # --- Save transcript (upsert into transcripts table) ---
        t_db_start = time.monotonic()
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

        db_ms = (time.monotonic() - t_db_start) * 1000

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

        t_total_ms = (time.monotonic() - t_total_start) * 1000

        seg_obj["_meta"]["language"] = info.language
        seg_obj["_meta"]["metrics"] = {
            "hf_worker": True,
            "wakeTime": round(wake_time_ms),
            "modelLoadTime": round(global_model_load_ms),
            "dlTime": round(dl_ms),
            "audioExtTime": round(audio_ext_ms),
            "whisperTime": round(whisper_ms),
            "dbSaveTime": round(db_ms),
            "totalTime": round(t_total_ms),
        }

        if conditional_update({
            "status": "TRANSCRIBED",
            "segments": seg_obj,
            "updated_at": utc_now(),
        }):
            print(f"[HF-Worker] Project {project_id} → TRANSCRIBED ✓", file=sys.stderr)
        else:
            print(f"[HF-Worker] Project {project_id}: lost ownership before TRANSCRIBED write (reaped?).", file=sys.stderr)

        print(f"[TRANSCRIBE] wake: {wake_time_ms:.0f}ms", file=sys.stderr)
        print(f"[TRANSCRIBE] worker ready: {global_model_load_ms:.0f}ms", file=sys.stderr)
        print(f"[TRANSCRIBE] download: {dl_ms:.0f}ms", file=sys.stderr)
        print(f"[TRANSCRIBE] audio extraction: {audio_ext_ms:.0f}ms", file=sys.stderr)
        print(f"[TRANSCRIBE] model load: 0ms (reused)", file=sys.stderr)
        print(f"[TRANSCRIBE] inference: {whisper_ms:.0f}ms", file=sys.stderr)
        print(f"[TRANSCRIBE] Supabase save: {db_ms:.0f}ms", file=sys.stderr)
        print(f"[TRANSCRIBE] TOTAL: {t_total_ms:.0f}ms", file=sys.stderr)
    except Exception as exc:
        # Never silently swallow: transient blips get an automatic retry with
        # backoff; persistent failures go FAILED with the error preserved in
        # _meta (without destroying the user's existing _meta, e.g. language).
        if not abandoned:
            print(f"[HF-Worker] ERROR processing {project_id}: {exc}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
        else:
            print(f"[HF-Worker] Job {project_id} abandoned after stage timeout: {exc}", file=sys.stderr)
        try:
            try:
                cur = supabase.table("projects").select("segments").eq("id", project_id).single().execute()
                seg_obj = cur.data.get("segments") if cur.data else None
            except Exception:
                seg_obj = None
            if not seg_obj or isinstance(seg_obj, list):
                seg_obj = {"_meta": {}}
            if not seg_obj.get("_meta"):
                seg_obj["_meta"] = {}
            attempts = get_attempts({"segments": seg_obj}) + 1
            seg_obj["_meta"]["attempts"] = attempts
            seg_obj["_meta"]["last_error"] = str(exc)[:500]

            if is_transient(exc) and attempts < MAX_ATTEMPTS and not abandoned:
                backoff_s = min(15 * attempts, 120)
                print(
                    f"[HF-Worker] Transient error on {project_id} "
                    f"(attempt {attempts}/{MAX_ATTEMPTS}); requeueing after {backoff_s}s.",
                    file=sys.stderr,
                )
                supabase.table("projects").update({
                    "status": "QUEUED_RENDER_TRANS",
                    "segments": seg_obj,
                    "updated_at": utc_now(),
                }).eq("id", project_id).execute()
                await asyncio.sleep(backoff_s)
            else:
                # Abandoned (timed-out stage) jobs are left for the reaper, which
                # counts the crash as an attempt and requeues or fails them.
                # Non-transient errors fail fast so the user sees a real error.
                if not abandoned:
                    print(f"[HF-Worker] {project_id} → FAILED (attempt {attempts}).", file=sys.stderr)
                    supabase.table("projects").update({
                        "status": "FAILED",
                        "segments": seg_obj,
                        "updated_at": utc_now(),
                    }).eq("id", project_id).execute()
        except Exception as supabase_err:
            print(f"[HF-Worker] Failed to update project {project_id} after error: {supabase_err}", file=sys.stderr)

    finally:
        # Stop the heartbeat first so the row isn't touched after we finish.
        if hb_task:
            stop_hb.set()
            try:
                await asyncio.wait_for(hb_task, timeout=5)
            except Exception:
                pass
        # Always clean up temp files — runs on both success AND failure.
        for tmp_path in (tmp_video, tmp_audio):
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass


async def _run_job_guarded(project: dict):
    """Run one job under the concurrency bound; never let an exception kill the loop."""
    async with _job_semaphore:
        try:
            await process_job(project)
        except Exception as e:
            print(f"[HF-Worker] Unhandled error in job task {project.get('id')}: {e}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)


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
            # First: rescue jobs orphaned by a dead worker, then pick up new work.
            # Jobs run as tasks under a semaphore so one hung job can't wedge the rest.
            await reap_stale_jobs()
            res = await fetch_queued()
            if res.data:
                for proj in res.data:
                    asyncio.create_task(_run_job_guarded(proj))
        except Exception as poll_err:
            print(f"[HF-Worker] Polling error: {poll_err}", file=sys.stderr)

        await asyncio.sleep(3)


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(polling_daemon())


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)

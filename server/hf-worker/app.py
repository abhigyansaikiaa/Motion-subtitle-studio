import os
import sys
import time
import json
import uuid
import boto3
import asyncio
import traceback
import subprocess
import faster_whisper
from datetime import datetime
from fastapi import FastAPI
from supabase import create_client, Client

app = FastAPI()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

R2_ACCOUNT_ID = os.environ.get("R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY")
R2_BUCKET = os.environ.get("R2_BUCKET")

# Initialize Supabase
supabase: Client = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Initialize R2/boto3
s3_client = None
if R2_ACCOUNT_ID and R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY:
    s3_client = boto3.client(
        's3',
        endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        region_name="auto"
    )

# Load Model Globally
print("[HF-Worker] Loading faster-whisper tiny model...", file=sys.stderr)
try:
    model = faster_whisper.WhisperModel(
        "tiny",
        device="cpu",
        compute_type="int8",
        cpu_threads=4,
        num_workers=2
    )
    print("[HF-Worker] Model loaded.", file=sys.stderr)
except Exception as e:
    print("[HF-Worker] Failed to load model:", e, file=sys.stderr)
    model = None

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Hugging Face Transcription Worker is running."}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

async def process_job(project):
    project_id = project['id']
    try:
        # Atomic claim!
        claim_res = supabase.table('projects').update({
            'status': 'TRANSCRIBING',
            'updated_at': datetime.utcnow().isoformat()
        }).eq('id', project_id).eq('status', 'QUEUED_TRANSCRIPTION').execute()

        if not claim_res.data or len(claim_res.data) == 0:
            print(f"[HF-Worker] Job {project_id} already claimed by another worker.")
            return

        print(f"[HF-Worker] Claimed project {project_id}!")
        
        # Determine R2 Key
        b2_key = None
        if 'videos' in project and project['videos'] and 'storage_path' in project['videos']:
            b2_key = project['videos']['storage_path']
        else:
            b2_key = project['video_id']

        if not b2_key:
            raise Exception("No video storage path found.")

        # Download Video
        tmp_video = f"/tmp/{uuid.uuid4()}.mp4"
        tmp_audio = f"/tmp/{uuid.uuid4()}.wav"
        
        print(f"[HF-Worker] Downloading {b2_key} to {tmp_video}...")
        s3_client.download_file(R2_BUCKET, b2_key, tmp_video)

        # Extract Audio
        print(f"[HF-Worker] Extracting audio to {tmp_audio}...")
        t0 = time.time()
        subprocess.run([
            "ffmpeg", "-i", tmp_video,
            "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le",
            tmp_audio, "-y"
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        audio_ext_time = (time.time() - t0) * 1000

        # Transcribe
        language = "auto"
        if 'segments' in project and project['segments'] and '_meta' in project['segments']:
            language = project['segments']['_meta'].get('language', 'auto')
            
        transcribe_args = {
            "word_timestamps": True,
            "beam_size": 1,
            "vad_filter": True,
            "vad_parameters": {"min_silence_duration_ms": 500},
            "condition_on_previous_text": False,
        }
        if language and language.lower() != "auto":
            transcribe_args["language"] = language

        print(f"[HF-Worker] Transcribing {tmp_audio} (lang: {language})...")
        t0 = time.time()
        segments_iter, info = model.transcribe(tmp_audio, **transcribe_args)
        
        words_raw = []
        word_index = 0
        for segment in segments_iter:
            if segment.words:
                for w in segment.words:
                    words_raw.append({
                        "id": str(uuid.uuid4()),
                        "word": w.word.strip(),
                        "start": w.start,
                        "end": w.end,
                        "index": word_index
                    })
                    word_index += 1
        whisper_time = (time.time() - t0) * 1000

        print(f"[HF-Worker] Transcription complete! {len(words_raw)} words.")

        # Save Transcript
        tr_res = supabase.table('transcripts').select('id').eq('project_id', project_id).execute()
        if tr_res.data and len(tr_res.data) > 0:
            supabase.table('transcripts').update({'words': words_raw}).eq('id', tr_res.data[0]['id']).execute()
        else:
            supabase.table('transcripts').insert({'project_id': project_id, 'words': words_raw}).execute()

        # Update Project Status
        segments = project.get('segments', {})
        if isinstance(segments, list):
            segments = {'_meta': {}, 'data': segments}
        if not segments:
            segments = {'_meta': {}}
        if not segments.get('_meta'):
            segments['_meta'] = {}
        
        segments['_meta']['language'] = info.language
        segments['_meta']['metrics'] = {
            "hf_worker": True,
            "audioExtTime": audio_ext_time,
            "whisperTime": whisper_time
        }

        supabase.table('projects').update({
            'status': 'TRANSCRIBED',
            'segments': segments,
            'updated_at': datetime.utcnow().isoformat()
        }).eq('id', project_id).execute()

        print(f"[HF-Worker] Successfully completed project {project_id}")

    except Exception as e:
        print(f"[HF-Worker] Error processing {project_id}:", e)
        traceback.print_exc()
        try:
            supabase.table('projects').update({
                'status': 'FAILED',
                'updated_at': datetime.utcnow().isoformat()
            }).eq('id', project_id).execute()
        except:
            pass
    finally:
        if 'tmp_video' in locals() and os.path.exists(tmp_video):
            os.remove(tmp_video)
        if 'tmp_audio' in locals() and os.path.exists(tmp_audio):
            os.remove(tmp_audio)


async def polling_daemon():
    if not supabase or not s3_client:
        print("[HF-Worker] Missing configuration (Supabase or R2). Polling disabled.", file=sys.stderr)
        return
    print("[HF-Worker] Polling daemon started.", file=sys.stderr)
    while True:
        try:
            res = supabase.table('projects').select('*, videos!projects_video_id_fkey(storage_path)').eq('status', 'QUEUED_TRANSCRIPTION').execute()
            if res.data and len(res.data) > 0:
                for proj in res.data:
                    await process_job(proj)
        except Exception as e:
            print("[HF-Worker] Polling error:", e, file=sys.stderr)
        
        await asyncio.sleep(3)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(polling_daemon())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)

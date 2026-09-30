import sys
import json
import traceback
import faster_whisper
import time

def main():
    print("[DAEMON] Initializing faster-whisper tiny model (int8)...", file=sys.stderr)
    try:
        model = faster_whisper.WhisperModel(
            "base",
            device="cpu",
            compute_type="int8",
            cpu_threads=4,
            num_workers=2
        )
        print("[DAEMON] Model loaded successfully. Waiting for tasks on stdin.", file=sys.stderr)
    except Exception as e:
        print("[DAEMON] Failed to load model:", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
            
        try:
            req = json.loads(line)
            job_id = req.get("id")
            input_path = req.get("videoPath")
            language = req.get("language")

            if not job_id or not input_path:
                print(json.dumps({"error": "Missing id or videoPath"}), flush=True)
                continue

            print(f"[DAEMON] Received task {job_id}: {input_path} (lang: {language})", file=sys.stderr)

            transcribe_args = {
                "word_timestamps": True,
                "beam_size": 5,
                "vad_filter": True,
                "vad_parameters": {"min_silence_duration_ms": 2000},
                "condition_on_previous_text": True,
            }
            
            if language and language.lower() != "auto":
                transcribe_args["language"] = language

            t0 = time.time()
            segments_iter, info = model.transcribe(input_path, **transcribe_args)
            
            segments = []
            word_count = 0
            
            for segment in segments_iter:
                seg_dict = {
                    "start": segment.start,
                    "end": segment.end,
                    "text": segment.text.strip(),
                    "words": []
                }
                if segment.words:
                    for word in segment.words:
                        seg_dict["words"].append({
                            "word": word.word.strip(),
                            "start": word.start,
                            "end": word.end
                        })
                        word_count += 1
                segments.append(seg_dict)

            t1 = time.time()
            print(f"[DAEMON] Task {job_id} completed in {t1-t0:.2f}s (words: {word_count})", file=sys.stderr)

            # Important: output only exactly one JSON object per task on stdout
            result = {
                "id": job_id,
                "language": info.language,
                "language_probability": info.language_probability,
                "segments": segments
            }
            print(json.dumps(result), flush=True)

        except Exception as e:
            print(f"[DAEMON] Error processing task:", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            print(json.dumps({"id": req.get("id", "unknown"), "error": str(e)}), flush=True)

if __name__ == "__main__":
    main()

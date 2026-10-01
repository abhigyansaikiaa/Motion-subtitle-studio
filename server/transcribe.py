import sys
import json
import traceback
import time

def main():
    try:
        if len(sys.argv) < 2:
            print("Usage: python transcribe.py <audio_or_video_path>", file=sys.stderr)
            sys.exit(1)

        import argparse
        import numpy as np
        from scipy.io import wavfile

        parser = argparse.ArgumentParser()
        parser.add_argument("input_path")
        parser.add_argument("--language", default=None)
        args = parser.parse_args()

        input_path = args.input_path
        language = args.language
        model_size = "base"

        print(f"[TRANSCRIBE-WORKER] Loading faster-whisper model '{model_size}'...", file=sys.stderr)
        
        # We wrap the import here so that failure to load the module is caught easily
        import faster_whisper
        
        t0 = time.time()
        # cpu_threads=4 saturates both vCPUs on the GitHub runner.
        # num_workers=2 allows overlapping audio chunks with inference.
        model = faster_whisper.WhisperModel(
            model_size,
            device="cpu",
            compute_type="int8",
            cpu_threads=4,
            num_workers=2
        )
        load_time = time.time() - t0
        print(f"[TRANSCRIBE-WORKER] Model loaded in {load_time:.2f}s", file=sys.stderr)

        print(f"[TRANSCRIBE-WORKER] Transcribing '{input_path}'...", file=sys.stderr)
        t1 = time.time()

        transcribe_args = {
            "word_timestamps": True,
            "beam_size": 5,
            "condition_on_previous_text": True,
        }
        if language and language.lower() != "auto":
            transcribe_args["language"] = language
            
        # Bypass PyAV completely by loading the WAV file manually
        # ffmpeg already ensured it's 16kHz, mono, s16le
        sample_rate, data = wavfile.read(input_path)
        
        # Convert to float32 in range [-1.0, 1.0] as expected by Whisper
        if data.dtype != np.float32:
            data = data.astype(np.float32) / 32768.0

        segments, info = model.transcribe(data, **transcribe_args)
        
        output = {"segments": []}
        word_count = 0
        
        for segment in segments:
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
            output["segments"].append(seg_dict)
        
        transcribe_time = time.time() - t1
        print(f"[TRANSCRIBE-WORKER] Transcription completed in {transcribe_time:.2f}s (words: {word_count})", file=sys.stderr)

        # Ensure we output ONLY the JSON to stdout
        json_output = json.dumps(output, ensure_ascii=False)
        print(json_output)
        
        sys.exit(0)
    except Exception as e:
        print("[TRANSCRIBE-WORKER] ERROR:", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()

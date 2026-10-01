FROM python:3.10-slim

WORKDIR /app

# Install system dependencies.
# ffmpeg is required for audio extraction.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user (Hugging Face Spaces requirement).
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR $HOME/app

# Install Python dependencies first (layer cached unless requirements change).
COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# FIX #3: Bake the faster-whisper model weights into the image layer.
# This downloads the weights exactly once at build time and stores them in
# ~/.cache/huggingface/hub/ inside the image. On every container start the
# model loads from the local cache — no network download, no cold-start delay.
# Both base (default quality) and tiny (WHISPER_MODEL=tiny speed option) are
# baked so switching models never triggers a download at runtime.
#
# NOTE: weights are fetched with snapshot_download (pure file download, tiny
# RAM footprint). Instantiating WhisperModel here instead would LOAD each
# model into RAM (~1GB for base) and OOM-kill the Docker build on Render.
RUN python - <<'EOF'
from huggingface_hub import snapshot_download
for m in ('base', 'tiny'):
    print(f'Downloading faster-whisper {m} weights...', flush=True)
    snapshot_download(f'Systran/faster-whisper-{m}')
print('Model weights cached successfully.')
EOF

# Copy application code (changes here do NOT invalidate the model cache layer above).
COPY --chown=user . $HOME/app

# Expose port 7860 (Hugging Face Spaces default).
EXPOSE 7860

# Respect Render's $PORT when present; fall back to 7860 for Hugging Face Spaces.
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-7860}"]

FROM python:3.10-slim

WORKDIR /app

# Install system dependencies (ffmpeg is required for audio extraction)
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create a non-root user (Hugging Face Spaces requirement)
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

# Change working directory to the user's home
WORKDIR $HOME/app

# Copy application code
COPY --chown=user . $HOME/app

# Pre-download the Whisper model to avoid downloading it on every restart
# (This is optional but good practice. For now, it will download on first run)

# Expose port 7860 (Hugging Face Spaces default port)
EXPOSE 7860

# Run the FastAPI server
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]

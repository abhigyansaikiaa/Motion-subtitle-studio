FROM node:22-bookworm-slim

# Install dependencies for Chrome/Puppeteer and FFmpeg
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libxss1 \
    libnss3 \
    libasound2 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libgbm-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Add non-root user (Hugging Face requires running as non-root)
RUN useradd -m -u 1001 user

WORKDIR /app

# Copy package files (we will copy the entire server folder so we have access to engine/ etc)
# But for caching we could just copy package.json first
COPY --chown=user package*.json ./
RUN npm install

# Setup puppeteer cache and install Chrome for the non-root user
ENV PUPPETEER_CACHE_DIR=/home/user/.cache/puppeteer
RUN mkdir -p /home/user/.cache/puppeteer \
    && chown -R user:user /home/user/.cache/puppeteer \
    && npx puppeteer browsers install chrome

# Copy all server code to the worker, ensuring the user owns it
COPY --chown=user . .

USER user

EXPOSE 7860

CMD ["node", "hf-node-worker/app.js"]

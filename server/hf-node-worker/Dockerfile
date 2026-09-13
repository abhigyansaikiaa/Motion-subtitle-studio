FROM node:20-slim

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

# Copy all server code to the worker, ensuring the user owns it
COPY --chown=user . .

USER user

EXPOSE 7860

CMD ["node", "app.js"]

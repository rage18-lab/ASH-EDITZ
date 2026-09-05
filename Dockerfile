FROM node:24-bookworm-slim

# Install system dependencies for ffmpeg, canvas, sqlite, and voice
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    make \
    g++ \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

CMD ["node", "--no-warnings", "Shard.js"]
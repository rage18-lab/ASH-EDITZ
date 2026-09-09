FROM node:22-bookworm-slim

# Only ffmpeg is needed for voice/audio processing.
# sql.js ships as pure WASM — no node-gyp / python / make / g++ required.
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
# Install all deps (including sql.js WASM assets)
RUN npm install --no-fund --no-audit

COPY . .

CMD ["node", "--no-warnings", "shard.js"]
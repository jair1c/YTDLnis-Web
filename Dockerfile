# Multi-stage Dockerfile for YTDLnis Web

# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: BgUtils POT Provider (Official image with Botguard token generator)
FROM brainicism/bgutil-ytdlp-pot-provider:latest AS pot-provider

# Stage 3: Backend & Production Runner
FROM python:3.11-slim
WORKDIR /app

# Install FFmpeg, Node.js 22 (for YouTube JS challenge & PO Token server) and required tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    ffmpeg \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Copy prebuilt bgutil service from official image
COPY --from=pot-provider /app /opt/bgutil

# Install Python dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# Copy Backend application code
COPY backend/ ./backend/

# Copy built frontend assets into frontend/dist
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose port (default 8000, Render/Railway inject PORT env var)
ENV PORT=8000
EXPOSE 8000

# Start PO Token server on port 4416 in background, then launch FastAPI
CMD ["sh", "-c", "if [ -d /opt/bgutil ]; then (cd /opt/bgutil && node build/main.js --host 127.0.0.1 --port 4416 &); sleep 2; fi; cd /app/backend && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]

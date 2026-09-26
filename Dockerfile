# Multi-architecture Dockerfile for SpatialSense (Raspberry Pi ARM64 & x86_64)
FROM node:20-bookworm-slim

# Prevent interactive prompts during apt install
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# 1. Install system dependencies for OpenCV and V4L2 camera capture
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    python3-full \
    libgl1 \
    libglib2.0-0 \
    v4l-utils \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 2. Install Node.js frontend and Express dependencies (including native ARM64/x86 optional bindings)
COPY package.json .npmrc* ./
RUN npm install --include=optional

# 3. Install Python Computer Vision & Edge dependencies
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r backend/requirements.txt

# 4. Copy application source code
COPY . .

# 5. Build static React production bundle
ENV NODE_OPTIONS="--max-old-space-size=2048"
RUN npm run build

# Make entrypoint script executable
RUN chmod +x entrypoint.sh

# Expose both service ports:
# 3000 -> Web Dashboard (React + Express)
# 8000 -> Python OpenCV Edge CV & MJPEG Camera Stream
EXPOSE 3000 8000

# Set entrypoint to run both services concurrently with graceful shutdown
ENTRYPOINT ["/app/entrypoint.sh"]

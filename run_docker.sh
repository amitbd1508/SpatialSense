#!/usr/bin/env bash
# SpatialSense - 1-Command Docker Launcher for Raspberry Pi & Linux
set -e

echo "=========================================================="
echo "    SpatialSense: Privacy-First Spatial Intelligence      "
echo "                 One-Command Docker Run                   "
echo "=========================================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "[!] Docker is not installed on this system."
    echo "    To install Docker on Raspberry Pi, run:"
    echo "    curl -fsSL https://get.docker.com | sh"
    echo "    sudo usermod -aG docker \$USER"
    exit 1
fi

# Detect USB camera
if [ -e /dev/video0 ]; then
    echo "[✓] USB Camera detected at /dev/video0"
else
    echo "[!] Warning: No /dev/video0 detected. Make sure your USB camera is plugged in."
fi

echo "Building and launching SpatialSense container..."

# Try docker compose first
if docker compose version &> /dev/null; then
    docker compose up --build -d
elif command -v docker-compose &> /dev/null; then
    docker-compose up --build -d
else
    # Fallback to pure docker CLI
    echo "Building Docker image..."
    docker build -t spatialsense:latest .
    docker rm -f spatialsense 2>/dev/null || true
    docker run -d \
        --name spatialsense \
        --restart unless-stopped \
        --privileged \
        -v /dev:/dev \
        -v "$(pwd)/data:/app/data" \
        -p 3000:3000 \
        -p 8000:8000 \
        spatialsense:latest
fi

echo ""
echo "=========================================================="
echo " [✓] SpatialSense is now running in Docker!"
echo "=========================================================="
echo " 🌐 Web Dashboard:         http://localhost:3000"
echo " 📹 Live Camera & Edge CV: http://localhost:8000"
echo " 📜 Container Logs:        docker logs -f spatialsense"
echo " 🛑 Stop Container:        docker compose down"
echo "=========================================================="

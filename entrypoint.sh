#!/bin/bash
set -e

echo "=========================================================="
echo "    SpatialSense: Privacy-First Spatial Intelligence      "
echo "              Starting Docker Container Node              "
echo "=========================================================="

# Ensure persistent data directory exists
mkdir -p /app/data

# Scan and print detected video devices
echo "Scanning V4L2 USB camera devices..."
if ls /dev/video* 1> /dev/null 2>&1; then
    for dev in /dev/video*; do
        echo " [✓] Found camera device node: $dev"
    done
else
    echo " [!] Notice: No /dev/video* devices found yet."
    echo "     (To enable USB camera, mount with: --privileged -v /dev:/dev)"
fi

# Function to handle graceful shutdown
cleanup() {
    echo "Stopping all services gracefully..."
    kill $(jobs -p) 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM

echo "Starting Python OpenCV Edge Engine (backend/main.py) on port 8000..."
python3 -u backend/main.py &
PYTHON_PID=$!

# Give Python engine a moment to bind port 8000
sleep 1

echo "Starting Web Dashboard Server (React + Express) on port 3000..."
npm start &
NODE_PID=$!

echo "=========================================================="
echo " [✓] Live Camera Stream & Edge API: http://0.0.0.0:8000"
echo " [✓] Full Web Dashboard:            http://0.0.0.0:3000"
echo "=========================================================="

# Wait for both processes
wait $PYTHON_PID $NODE_PID

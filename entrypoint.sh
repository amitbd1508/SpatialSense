#!/bin/bash
set -e

echo "=========================================================="
echo "    SpatialSense: Privacy-First Spatial Intelligence      "
echo "              Starting Docker Container Node              "
echo "=========================================================="

# Check if video devices exist
if [ -e /dev/video0 ]; then
    echo "[✓] USB Camera detected at /dev/video0"
else
    echo "[!] Notice: /dev/video0 not detected. Running in simulated fallback mode."
    echo "    (To enable USB camera, run container with: --device /dev/video0:/dev/video0)"
fi

# Function to handle graceful shutdown
cleanup() {
    echo "Stopping all services..."
    kill $(jobs -p) 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM

echo "Starting Python OpenCV Edge Engine on port 8000..."
python3 backend/main.py &
PYTHON_PID=$!

echo "Starting Web Dashboard Server on port 3000..."
npm start &
NODE_PID=$!

echo "=========================================================="
echo " [✓] Live Camera Stream & Edge API: http://0.0.0.0:8000"
echo " [✓] Full Web Dashboard:            http://0.0.0.0:3000"
echo "=========================================================="

# Wait for both processes
wait $PYTHON_PID $NODE_PID

#!/usr/bin/env bash
# SpatialSense - Start edge background service
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
cd "$DIR"

echo "Starting SpatialSense Edge Service..."
if [ -d "venv" ]; then
    source venv/bin/activate
fi

python3 backend/main.py > spatialsense.log 2>&1 &
echo $! > spatialsense.pid
echo "SpatialSense started with PID $(cat spatialsense.pid) on http://0.0.0.0:8000"

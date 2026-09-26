#!/usr/bin/env bash
# SpatialSense - Stop edge background service
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
cd "$DIR"

if [ -f "spatialsense.pid" ]; then
    PID=$(cat spatialsense.pid)
    echo "Stopping SpatialSense PID: $PID..."
    kill "$PID" || true
    rm spatialsense.pid
    echo "Stopped."
else
    echo "No running PID found."
fi

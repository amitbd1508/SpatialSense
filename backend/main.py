"""
SpatialSense - Raspberry Pi Edge Backend (FastAPI + OpenCV)
Runs locally on the Raspberry Pi. Privacy-first: no raw video uploaded.
Exposes standardized REST endpoints matching the web dashboard specification.
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import time
import os
import glob
import threading
from cv_pipeline import EdgeCVPipeline
from sensor_interface import SensorObservation, CameraSensor

app = FastAPI(title="SpatialSense Edge Node", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pipeline = EdgeCVPipeline()
camera_sensor = CameraSensor(camera_index=0, width=640, height=480, fps=10)

# In-memory edge state (persisted to SQLite in production)
EDGE_STATE = {
    "room_name": "Living & Workspace 101",
    "is_occupied": True,
    "current_activity": "SITTING",
    "current_zone": "Work Desk",
    "tracking_id": "person_001",
    "last_seen": time.time(),
    "session_start": time.time() - 2500,
    "posture_start": time.time() - 900,
    "position": {"x": 0.72, "y": 0.35},
    "bbox": {"x": 0.64, "y": 0.22, "width": 0.16, "height": 0.26},
    "active_alert": None,
    "stats": {
        "sitting_seconds": 15400,
        "standing_seconds": 3200,
        "walking_seconds": 1900,
        "occupied_seconds": 20500,
        "longest_sitting_seconds": 5400,
        "sessions_count": 4,
        "first_presence": "08:14",
        "last_presence": "Active now",
        "falls_detected": 0,
        "inactivity_alerts": 0
    }
}

# Background thread to run camera reading if USB camera is attached
def camera_worker_loop():
    camera_sensor.initialize()
    while True:
        try:
            if camera_sensor.is_connected:
                obs = camera_sensor.read_observation()
                if obs:
                    EDGE_STATE["is_occupied"] = obs.presence
                    if obs.presence:
                        EDGE_STATE["current_activity"] = obs.activity
                        EDGE_STATE["position"] = obs.position
                        if obs.bbox:
                            EDGE_STATE["bbox"] = obs.bbox
                        if obs.activity == "POSSIBLE_FALL" and not EDGE_STATE["active_alert"]:
                            EDGE_STATE["active_alert"] = {
                                "id": f"alert-{int(time.time())}",
                                "event_type": "POTENTIAL_FALL",
                                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                                "confidence": 0.94,
                                "metadata": {"reason": "Rapid vertical descent & horizontal posture detected on USB camera"}
                            }
                            EDGE_STATE["stats"]["falls_detected"] += 1
            time.sleep(0.1) # 10 FPS
        except Exception as e:
            time.sleep(1.0)

camera_thread = threading.Thread(target=camera_worker_loop, daemon=True)
camera_thread.start()

@app.get("/api/health")
def get_health():
    return {
        "status": "ok",
        "device": "Raspberry Pi 4 / 5",
        "camera_connected": camera_sensor.is_connected,
        "camera_index": camera_sensor.camera_index,
        "uptime_seconds": int(time.time() - EDGE_STATE["session_start"]),
        "privacy_enforced": True,
        "cloud_video_stream": False
    }

@app.get("/api/camera/devices")
def list_camera_devices():
    """Returns detected video devices under /dev/video* on Raspberry Pi."""
    devices = []
    v4l_paths = sorted(glob.glob("/dev/video*"))
    for p in v4l_paths:
        devices.append({"device": p, "name": f"V4L2 Device {p}"})
    return {"devices": devices, "active_index": camera_sensor.camera_index}

@app.get("/api/camera/stream")
def get_camera_stream():
    """
    MJPEG Live Video Stream for local browser dashboard.
    Overlays bounding box, center point, and anonymized silhouette.
    """
    def generate_mjpeg():
        while True:
            jpeg_bytes = camera_sensor.get_annotated_jpeg()
            if jpeg_bytes:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + jpeg_bytes + b'\r\n')
            time.sleep(0.1)

    return StreamingResponse(generate_mjpeg(), media_type="multipart/x-mixed-replace; boundary=frame")

@app.get("/api/camera/frame")
def get_single_frame():
    """Returns a single JPEG frame for live snapshots."""
    jpeg_bytes = camera_sensor.get_annotated_jpeg()
    if jpeg_bytes:
        return Response(content=jpeg_bytes, media_type="image/jpeg")
    raise HTTPException(status_code=503, detail="Camera frame unavailable")

@app.get("/api/status")
def get_status():
    now = time.time()
    return {
        "isOccupied": EDGE_STATE["is_occupied"],
        "currentPersonId": EDGE_STATE["tracking_id"],
        "currentActivity": EDGE_STATE["current_activity"],
        "currentZone": {"name": EDGE_STATE["current_zone"]},
        "sessionDurationSeconds": int(now - EDGE_STATE["session_start"]),
        "activityDurationSeconds": int(now - EDGE_STATE["posture_start"]),
        "position": EDGE_STATE["position"],
        "bbox": EDGE_STATE["bbox"],
        "activeAlert": EDGE_STATE["active_alert"]
    }

@app.get("/api/statistics")
def get_statistics():
    return {
        "occupancy": {
            "totalSeconds": EDGE_STATE["stats"]["occupied_seconds"],
            "firstPresence": EDGE_STATE["stats"]["first_presence"],
            "lastPresence": EDGE_STATE["stats"]["last_presence"],
            "sessionsCount": EDGE_STATE["stats"]["sessions_count"],
            "isCurrentlyOccupied": EDGE_STATE["is_occupied"]
        },
        "posture": {
            "sittingSeconds": EDGE_STATE["stats"]["sitting_seconds"],
            "standingSeconds": EDGE_STATE["stats"]["standing_seconds"],
            "walkingSeconds": EDGE_STATE["stats"]["walking_seconds"],
            "longestSittingSeconds": EDGE_STATE["stats"]["longest_sitting_seconds"]
        },
        "safety": {
            "fallsDetected": EDGE_STATE["stats"]["falls_detected"],
            "inactivityAlerts": EDGE_STATE["stats"]["inactivity_alerts"]
        }
    }

@app.post("/api/simulate/fall")
def simulate_fall():
    EDGE_STATE["current_activity"] = "POSSIBLE_FALL"
    EDGE_STATE["active_alert"] = {
        "id": f"alert-{int(time.time())}",
        "event_type": "POTENTIAL_FALL",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "confidence": 0.95,
        "metadata": {"reason": "Sudden posture inversion to floor plane"}
    }
    EDGE_STATE["stats"]["falls_detected"] += 1
    return {"success": True, "alert": EDGE_STATE["active_alert"]}

@app.post("/api/events/{event_id}/acknowledge")
def acknowledge_event(event_id: str):
    EDGE_STATE["active_alert"] = None
    return {"success": True, "acknowledged": event_id}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)

"""
SpatialSense - Raspberry Pi Edge Backend (FastAPI + OpenCV)
Runs locally on the Raspberry Pi. Privacy-first: no raw video uploaded.
Exposes standardized REST endpoints matching the web dashboard specification.
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response, HTMLResponse
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

@app.get("/", response_class=HTMLResponse)
def root_view():
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SpatialSense - Privacy-Preserving Spatial Intelligence Dashboard</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
        <style>
            :root {
                --bg: #09090b;
                --card-bg: #121215;
                --card-border: #222228;
                --text: #f4f4f6;
                --muted: #8e8e99;
                --accent: #10b981;
                --accent-dim: rgba(16, 185, 129, 0.15);
                --danger: #ef4444;
                --danger-dim: rgba(239, 68, 68, 0.15);
                --sky: #0ea5e9;
                --sky-dim: rgba(14, 165, 233, 0.15);
            }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
                background: var(--bg);
                color: var(--text);
                font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
                min-height: 100vh;
                display: flex;
                flex-direction: column;
            }
            header {
                background: #0d0d10;
                border-bottom: 1px solid var(--card-border);
                padding: 14px 24px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                position: sticky;
                top: 0;
                z-index: 50;
            }
            .brand {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            .brand-logo {
                width: 32px;
                height: 32px;
                border-radius: 8px;
                background: linear-gradient(135deg, #10b981, #059669);
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 700;
                color: #fff;
                font-size: 16px;
            }
            .brand-title {
                font-size: 15px;
                font-weight: 700;
                letter-spacing: -0.01em;
            }
            .brand-sub {
                font-size: 11px;
                color: var(--muted);
            }
            .status-pill {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 6px 14px;
                border-radius: 9999px;
                background: var(--accent-dim);
                border: 1px solid rgba(16, 185, 129, 0.3);
                font-size: 12px;
                color: #34d399;
                font-weight: 600;
            }
            .pulse-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #10b981;
                box-shadow: 0 0 10px #10b981;
                animation: pulse 1.8s infinite;
            }
            @keyframes pulse {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.4; transform: scale(0.85); }
            }
            main {
                max-width: 1440px;
                width: 100%;
                margin: 0 auto;
                padding: 24px;
                display: flex;
                flex-direction: column;
                gap: 24px;
                flex: 1;
            }
            .metrics-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                gap: 16px;
            }
            .card {
                background: var(--card-bg);
                border: 1px solid var(--card-border);
                border-radius: 12px;
                padding: 20px;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
            }
            .card-title {
                font-size: 12px;
                color: var(--muted);
                text-transform: uppercase;
                letter-spacing: 0.05em;
                font-weight: 600;
                margin-bottom: 8px;
            }
            .card-value {
                font-size: 28px;
                font-weight: 700;
                font-family: 'JetBrains Mono', monospace;
                letter-spacing: -0.02em;
            }
            .card-sub {
                font-size: 12px;
                color: var(--muted);
                margin-top: 6px;
            }
            .main-grid {
                display: grid;
                grid-template-columns: 2fr 1fr;
                gap: 24px;
            }
            @media (max-width: 960px) {
                .main-grid { grid-template-columns: 1fr; }
            }
            .video-card {
                background: var(--card-bg);
                border: 1px solid var(--card-border);
                border-radius: 14px;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }
            .video-header {
                padding: 14px 20px;
                border-bottom: 1px solid var(--card-border);
                display: flex;
                align-items: center;
                justify-content: space-between;
                font-size: 13px;
                font-weight: 600;
                background: #0e0e12;
            }
            .viewport-container {
                position: relative;
                width: 100%;
                aspect-ratio: 16 / 10;
                background: #000;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
            }
            .viewport-container img {
                width: 100%;
                height: 100%;
                object-fit: contain;
            }
            .video-footer {
                padding: 14px 20px;
                border-top: 1px solid var(--card-border);
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 12px;
                font-size: 12px;
                background: #0e0e12;
            }
            .tele-label {
                color: var(--muted);
                font-size: 11px;
                margin-bottom: 2px;
            }
            .tele-val {
                font-family: 'JetBrains Mono', monospace;
                font-weight: 600;
            }
            .side-column {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }
            .btn {
                background: #1f1f26;
                color: var(--text);
                border: 1px solid var(--card-border);
                padding: 10px 16px;
                border-radius: 8px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                text-align: center;
                text-decoration: none;
                display: inline-block;
            }
            .btn:hover {
                background: #2a2a35;
                border-color: #3b3b4a;
            }
            .btn-danger {
                background: var(--danger-dim);
                border-color: rgba(239, 68, 68, 0.3);
                color: #f87171;
            }
            .btn-danger:hover {
                background: rgba(239, 68, 68, 0.25);
            }
            .timeline-card {
                background: var(--card-bg);
                border: 1px solid var(--card-border);
                border-radius: 12px;
                overflow: hidden;
            }
            .timeline-header {
                padding: 16px 20px;
                border-bottom: 1px solid var(--card-border);
                font-size: 13px;
                font-weight: 600;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            .timeline-list {
                max-height: 280px;
                overflow-y: auto;
                font-size: 12px;
            }
            .timeline-item {
                padding: 10px 20px;
                border-bottom: 1px solid #1a1a20;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            .timeline-item:last-child { border-bottom: none; }
            .timeline-time {
                font-family: 'JetBrains Mono', monospace;
                color: var(--muted);
                width: 80px;
            }
            .badge-posture {
                padding: 3px 8px;
                border-radius: 6px;
                font-size: 11px;
                font-weight: 600;
            }
            .badge-SITTING { background: var(--accent-dim); color: #34d399; }
            .badge-STANDING { background: var(--sky-dim); color: #38bdf8; }
            .badge-POSSIBLE_FALL { background: var(--danger-dim); color: #f87171; animation: pulse 1s infinite; }
            .badge-WALKING { background: rgba(168, 85, 247, 0.15); color: #c084fc; }
            .alert-banner {
                background: #450a0a;
                border: 1px solid #991b1b;
                color: #fecaca;
                padding: 14px 20px;
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                font-size: 13px;
                margin-bottom: 16px;
            }
        </style>
    </head>
    <body>
        <header>
            <div class="brand">
                <div class="brand-logo">S</div>
                <div>
                    <div class="brand-title">SpatialSense Edge Node</div>
                    <div class="brand-sub">Raspberry Pi Optical Activity & Fall Monitor</div>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
                <button id="pip-toggle-btn" class="btn" onclick="togglePipWindow()" style="font-size: 12px; padding: 6px 12px; display: flex; align-items: center; gap: 8px;">
                    <span>📹 Low-Res Live View</span>
                    <span id="pip-state" style="background: #27272a; color: #a1a1aa; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 10px; font-weight: 700;">OFF</span>
                </button>
                <div class="status-pill">
                    <div class="pulse-dot"></div>
                    <span id="header-status">Edge Engine Active</span>
                </div>
            </div>
        </header>

        <!-- Floating Low-Res Small Live View Window -->
        <div id="floating-pip-window" style="display: none; position: fixed; bottom: 20px; right: 20px; width: 240px; background: #121215; border: 1px solid #27272a; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.8); z-index: 9999; overflow: hidden; backdrop-filter: blur(8px);">
            <div style="padding: 6px 10px; background: #09090b; border-bottom: 1px solid #27272a; display: flex; align-items: center; justify-content: space-between; font-size: 11px; font-weight: 600;">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #10b981;"></span>
                    <span>Low-Res Live (160p)</span>
                </div>
                <button onclick="togglePipWindow()" style="background: none; border: none; color: #a1a1aa; cursor: pointer; font-size: 14px; line-height: 1;">✕</button>
            </div>
            <div style="position: relative; width: 240px; height: 160px; background: #000; display: flex; align-items: center; justify-content: center;">
                <img src="/api/camera/stream" style="width: 100%; height: 100%; object-fit: cover;" alt="Low Res Feed" />
                <div id="pip-posture-badge" style="position: absolute; top: 6px; left: 6px; font-size: 9px; font-weight: 700; background: rgba(16, 185, 129, 0.9); color: #fff; padding: 2px 6px; border-radius: 4px;">
                    STANDING
                </div>
                <div id="pip-coords" style="position: absolute; bottom: 6px; right: 6px; font-size: 8px; font-family: monospace; background: rgba(0,0,0,0.7); color: #e2e8f0; padding: 2px 4px; border-radius: 3px;">
                    0.50, 0.50
                </div>
            </div>
            <div style="padding: 6px 10px; font-size: 10px; color: #a1a1aa; display: flex; justify-content: space-between; background: #09090b; border-top: 1px solid #1e1e24;">
                <span id="pip-zone-tag">Work Desk</span>
                <span style="color: #38bdf8;">Edge Privacy Shield</span>
            </div>
        </div>

        <main>
            <!-- Dynamic Alert Banner if fall detected -->
            <div id="fall-alert-banner" class="alert-banner" style="display: none;">
                <div>
                    <strong>POTENTIAL FALL DETECTED</strong>
                    <div id="fall-alert-detail" style="font-size: 11px; margin-top: 2px;">Rapid vertical descent and horizontal posture detected on USB camera.</div>
                </div>
                <button class="btn" onclick="acknowledgeAlert()" style="background: #991b1b; color: #fff; border: none;">Acknowledge Alert</button>
            </div>

            <!-- Top Metric Cards -->
            <div class="metrics-grid">
                <div class="card">
                    <div class="card-title">Room Occupancy</div>
                    <div class="card-value" id="val-occupancy" style="color: #34d399;">Active</div>
                    <div class="card-sub" id="val-person-id">Person ID: person_001</div>
                </div>
                <div class="card">
                    <div class="card-title">Current Posture</div>
                    <div class="card-value" id="val-posture" style="color: #38bdf8;">STANDING</div>
                    <div class="card-sub" id="val-zone">In Zone: Work Desk</div>
                </div>
                <div class="card">
                    <div class="card-title">Session Duration</div>
                    <div class="card-value" id="val-duration">00:00:00</div>
                    <div class="card-sub">Continuous presence since entry</div>
                </div>
                <div class="card">
                    <div class="card-title">Posture Duration</div>
                    <div class="card-value" id="val-posture-duration" style="color: #fbbf24;">00:00:00</div>
                    <div class="card-sub">Current state stability</div>
                </div>
            </div>

            <!-- Main Interactive Section -->
            <div class="main-grid">
                <!-- Left: Live Video Stream & HUD -->
                <div class="video-card">
                    <div class="video-header">
                        <span>Live USB Camera Feed (Annotated HUD)</span>
                        <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--muted);" id="stream-info">/dev/video0 · 640x480 @ 10fps</span>
                    </div>
                    <div class="viewport-container">
                        <img id="camera-stream-img" src="/api/camera/stream" alt="Live Camera Feed"
                             onerror="this.onerror=null; this.src=''; this.parentElement.innerHTML='<div style=\\'text-align:center; padding:24px; color:#94a3b8;\\'><h3>Waiting for USB Camera...</h3><p style=\\'font-size:12px; margin-top:6px;\\'>Ensure USB camera is plugged in. Check: ls /dev/video*</p></div>';" />
                    </div>
                    <div class="video-footer">
                        <div>
                            <div class="tele-label">Coordinates (X, Y)</div>
                            <div class="tele-val" id="tele-pos">0.500, 0.500</div>
                        </div>
                        <div>
                            <div class="tele-label">Bounding Box</div>
                            <div class="tele-val" id="tele-bbox">0.24 x 0.55</div>
                        </div>
                        <div>
                            <div class="tele-label">Confidence</div>
                            <div class="tele-val" id="tele-conf" style="color: #34d399;">94%</div>
                        </div>
                        <div>
                            <div class="tele-label">Privacy Shield</div>
                            <div class="tele-val" style="color: #38bdf8;">On-Device Only</div>
                        </div>
                    </div>
                </div>

                <!-- Right: Controls, Safety Tests & Quick Endpoints -->
                <div class="side-column">
                    <!-- Fall Detection Test Card -->
                    <div class="card" style="gap: 12px;">
                        <div class="card-title">Incident Alert Test</div>
                        <p style="font-size: 12px; color: var(--muted); line-height: 1.5;">
                            Simulate an emergency fall event to verify the alert trigger and emergency banner pipeline.
                        </p>
                        <button class="btn btn-danger" onclick="triggerFallTest()">Test Fall Alert</button>
                    </div>

                    <!-- Room Zones Summary -->
                    <div class="card" style="gap: 8px;">
                        <div class="card-title">Calibrated Room Zones</div>
                        <div style="display: flex; flex-direction: column; gap: 8px; font-size: 12px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span>Work Desk (Desk)</span>
                                <span style="color: #10b981; font-weight: 600;">Zone 1</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span>Ergonomic Chair</span>
                                <span style="color: #8b5cf6; font-weight: 600;">Zone 2</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span>Lounge / Couch</span>
                                <span style="color: #f59e0b; font-weight: 600;">Zone 3</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span>Room Entry Door</span>
                                <span style="color: #06b6d4; font-weight: 600;">Zone 4</span>
                            </div>
                        </div>
                    </div>

                    <!-- Quick Endpoints -->
                    <div class="card" style="gap: 8px;">
                        <div class="card-title">Developer Quick Links</div>
                        <a class="btn" href="/api/camera/stream" target="_blank">Direct MJPEG Stream</a>
                        <a class="btn" href="/api/status" target="_blank">Raw Status JSON</a>
                        <a class="btn" href="/api/health" target="_blank">Health Endpoint</a>
                        <a class="btn" href="/docs" target="_blank">FastAPI Swagger Docs</a>
                    </div>
                </div>
            </div>

            <!-- Activity Event Log -->
            <div class="timeline-card">
                <div class="timeline-header">
                    <span>Recent Spatial Observations & Events</span>
                    <span style="font-size: 11px; color: var(--muted);" id="event-count">Live Stream</span>
                </div>
                <div class="timeline-list" id="timeline-list">
                    <div class="timeline-item">
                        <span class="timeline-time">Now</span>
                        <span>Monitoring active space</span>
                        <span class="badge-posture badge-STANDING">ACTIVE</span>
                    </div>
                </div>
            </div>
        </main>

        <script>
            function formatSecs(s) {
                const hrs = Math.floor(s / 3600).toString().padStart(2, '0');
                const mins = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
                const secs = Math.floor(s % 60).toString().padStart(2, '0');
                return `${hrs}:${mins}:${secs}`;
            }

            let lastActivity = '';
            const events = [];

            async function updateDashboard() {
                try {
                    const res = await fetch('/api/status');
                    if (!res.ok) return;
                    const data = await res.json();

                    // Update metrics
                    document.getElementById('val-occupancy').innerText = data.isOccupied ? 'Active' : 'Vacant';
                    document.getElementById('val-occupancy').style.color = data.isOccupied ? '#34d399' : '#94a3b8';
                    document.getElementById('val-person-id').innerText = data.currentPersonId ? `Person ID: ${data.currentPersonId}` : 'No person detected';

                    document.getElementById('val-posture').innerText = data.currentActivity || 'UNKNOWN';
                    document.getElementById('val-zone').innerText = `In Zone: ${data.currentZone?.name || 'Open Area'}`;

                    document.getElementById('val-duration').innerText = formatSecs(data.sessionDurationSeconds || 0);
                    document.getElementById('val-posture-duration').innerText = formatSecs(data.activityDurationSeconds || 0);

                    // Telemetry
                    if (data.position) {
                        document.getElementById('tele-pos').innerText = `${data.position.x.toFixed(3)}, ${data.position.y.toFixed(3)}`;
                    }
                    if (data.bbox) {
                        document.getElementById('tele-bbox').innerText = `${data.bbox.width.toFixed(2)} x ${data.bbox.height.toFixed(2)}`;
                    }

                    // Fall Alert Banner
                    const alertBanner = document.getElementById('fall-alert-banner');
                    if (data.activeAlert && !data.activeAlert.acknowledged) {
                        alertBanner.style.display = 'flex';
                        document.getElementById('fall-alert-detail').innerText = data.activeAlert.metadata?.reason || 'Possible fall detected';
                    } else {
                        alertBanner.style.display = 'none';
                    }

                    // Add to timeline on posture change
                    if (data.currentActivity && data.currentActivity !== lastActivity) {
                        lastActivity = data.currentActivity;
                        const now = new Date();
                        const timeStr = now.toTimeString().split(' ')[0];
                        const list = document.getElementById('timeline-list');
                        const item = document.createElement('div');
                        item.className = 'timeline-item';
                        item.innerHTML = `
                            <span class="timeline-time">${timeStr}</span>
                            <span>Person transitioned to <strong>${data.currentActivity}</strong> in ${data.currentZone?.name || 'Room'}</span>
                            <span class="badge-posture badge-${data.currentActivity}">${data.currentActivity}</span>
                        `;
                        list.prepend(item);
                    }
                    // Update floating PiP elements if active
                    const pipBadge = document.getElementById('pip-posture-badge');
                    if (pipBadge) {
                        pipBadge.innerText = data.currentActivity || 'STAND';
                        pipBadge.style.background = data.currentActivity === 'POSSIBLE_FALL' ? '#ef4444' : (data.currentActivity === 'SITTING' ? '#0ea5e9' : '#10b981');
                    }
                    if (data.position && document.getElementById('pip-coords')) {
                        document.getElementById('pip-coords').innerText = `${data.position.x.toFixed(2)}, ${data.position.y.toFixed(2)}`;
                    }
                    if (document.getElementById('pip-zone-tag')) {
                        document.getElementById('pip-zone-tag').innerText = data.currentZone?.name || 'Room Space';
                    }
                } catch (e) {
                    console.warn('Dashboard poll error:', e);
                }
            }

            let pipOpen = false;
            function togglePipWindow() {
                pipOpen = !pipOpen;
                const win = document.getElementById('floating-pip-window');
                const state = document.getElementById('pip-state');
                const btn = document.getElementById('pip-toggle-btn');
                if (pipOpen) {
                    win.style.display = 'block';
                    state.innerText = 'ON';
                    state.style.background = '#10b981';
                    state.style.color = '#000';
                    btn.style.borderColor = '#10b981';
                } else {
                    win.style.display = 'none';
                    state.innerText = 'OFF';
                    state.style.background = '#27272a';
                    state.style.color = '#a1a1aa';
                    btn.style.borderColor = '';
                }
            }

            async function triggerFallTest() {
                try {
                    await fetch('/api/simulate/fall', { method: 'POST' });
                    updateDashboard();
                } catch (e) {
                    alert('Simulation trigger failed');
                }
            }

            async function acknowledgeAlert() {
                try {
                    const statusRes = await fetch('/api/status');
                    const statusData = await statusRes.json();
                    if (statusData.activeAlert) {
                        await fetch(`/api/events/${statusData.activeAlert.id}/acknowledge`, { method: 'POST' });
                    }
                    document.getElementById('fall-alert-banner').style.display = 'none';
                    updateDashboard();
                } catch (e) {
                    document.getElementById('fall-alert-banner').style.display = 'none';
                }
            }

            // High frequency status update (every 1 second)
            setInterval(updateDashboard, 1000);
            updateDashboard();
        </script>
    </body>
    </html>
    """

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

class CameraConfigRequest(BaseModel):
    camera_index: Optional[int] = 0
    device_path: Optional[str] = None
    width: Optional[int] = 640
    height: Optional[int] = 480
    fps: Optional[int] = 10
    rotation: Optional[int] = 0
    flip_h: Optional[bool] = False
    brightness: Optional[int] = 0
    contrast: Optional[float] = 1.0
    privacy_mode: Optional[str] = "silhouette_only"
    motion_threshold: Optional[int] = 1200

@app.get("/api/camera/devices")
def list_camera_devices():
    """Returns detected video devices under /dev/video* on Raspberry Pi."""
    devices = CameraSensor.list_available_cameras()
    return {
        "devices": devices,
        "active_index": camera_sensor.camera_index,
        "is_connected": camera_sensor.is_connected,
        "active_resolution": f"{camera_sensor.width}x{camera_sensor.height}",
        "active_fps": camera_sensor.fps
    }

@app.get("/api/camera/config")
def get_camera_config():
    """Returns current edge camera configuration."""
    return {
        "camera_index": camera_sensor.camera_index,
        "width": camera_sensor.width,
        "height": camera_sensor.height,
        "fps": camera_sensor.fps,
        "rotation": camera_sensor.rotation,
        "flip_h": camera_sensor.flip_h,
        "brightness": camera_sensor.brightness,
        "contrast": camera_sensor.contrast,
        "privacy_mode": camera_sensor.privacy_mode,
        "motion_threshold": camera_sensor.motion_threshold,
        "is_connected": camera_sensor.is_connected,
        "device_name": camera_sensor.device_name
    }

@app.post("/api/camera/config")
def update_camera_config(req: CameraConfigRequest):
    """Dynamically applies new camera index, resolution, orientation, and privacy filters."""
    success = camera_sensor.reconfigure(
        camera_index=req.camera_index,
        width=req.width,
        height=req.height,
        fps=req.fps,
        rotation=req.rotation,
        flip_h=req.flip_h,
        brightness=req.brightness,
        contrast=req.contrast,
        privacy_mode=req.privacy_mode,
        motion_threshold=req.motion_threshold
    )
    return {
        "success": success,
        "is_connected": camera_sensor.is_connected,
        "camera_index": camera_sensor.camera_index,
        "width": camera_sensor.width,
        "height": camera_sensor.height,
        "fps": camera_sensor.fps,
        "rotation": camera_sensor.rotation,
        "flip_h": camera_sensor.flip_h,
        "privacy_mode": camera_sensor.privacy_mode
    }

@app.post("/api/camera/test")
def test_camera_device(req: CameraConfigRequest):
    """Probes a specific camera index to verify frame acquisition."""
    test_idx = req.camera_index if req.camera_index is not None else 0
    import cv2
    test_cap = cv2.VideoCapture(test_idx, cv2.CAP_V4L2)
    if not test_cap.isOpened():
        test_cap = cv2.VideoCapture(test_idx)
    
    can_open = test_cap.isOpened()
    has_frame = False
    if can_open:
        ret, frame = test_cap.read()
        has_frame = ret and frame is not None
        test_cap.release()

    return {
        "camera_index": test_idx,
        "device_path": f"/dev/video{test_idx}",
        "can_open": can_open,
        "has_frame": has_frame,
        "status": "ready" if (can_open and has_frame) else "unresponsive"
    }

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

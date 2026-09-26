# SpatialSense Docker Deployment Guide

This guide details how to build and run **SpatialSense** using Docker on Raspberry Pi (ARM64 / ARMv7) or Linux x86_64, with simultaneous execution of:
1. **Python OpenCV Edge CV Engine** (`backend/main.py`) on port `8000`.
2. **React + Express Web Dashboard** (`server.ts`) on port `3000`.
3. **Hardware USB Camera Access** via V4L2 (`/dev/video*`).

---

## 1. Quick Start (One Command)

From the project root directory, run:

```bash
chmod +x run_docker.sh
./run_docker.sh
```

Or using Docker Compose directly:

```bash
docker compose up --build -d
```

---

## 2. Docker Architecture & Components

```
┌─────────────────────────────────────────────────────────────┐
│                    SpatialSense Container                   │
│                                                             │
│   ┌──────────────────────────┐  ┌─────────────────────────┐ │
│   │   Python Edge Backend    │  │  Web Dashboard Server   │ │
│   │   (backend/main.py)      │  │  (Node.js / Express)     │ │
│   │                          │  │                         │ │
│   │  - OpenCV V4L2 Capture   │  │  - Privacy Dashboard    │ │
│   │  - Contour / Posture CV  │  │  - Heatmap & Analytics  │ │
│   │  - MJPEG Live Stream     │  │  - Safety & Fall Alerts │ │
│   │  - Port 8000             │  │  - Port 3000            │ │
│   └─────────────▲────────────┘  └────────────▲────────────┘ │
│                 │                            │              │
│                 └──────────┬─────────────────┘              │
│                            │                                │
│                   /app/entrypoint.sh                        │
└────────────────────────────┼────────────────────────────────┘
                             │
            Host Mounts: /dev and ./data
```

### Files Included:
- **`Dockerfile`**: Debian Bookworm slim base with Python 3, Node 20, OpenCV, `libv4l`, GStreamer, and V4L2 utilities.
- **`docker-compose.yml`**: Defines ports `3000` & `8000`, `--privileged` access, `/dev:/dev` hardware volume, and `./data:/app/data` persistence.
- **`entrypoint.sh`**: Scans `/dev/video*` hardware nodes, launches `backend/main.py` (unbuffered) alongside Express, and handles SIGTERM/SIGINT graceful shutdown.
- **`run_docker.sh`**: Single executable script that tests Docker installation, checks for `/dev/video0`, builds, and launches the container.
- **`backend/requirements.txt`**: FastAPI, Uvicorn, OpenCV headless, Pydantic, NumPy, and HTTPX.

---

## 3. Connecting Your USB Camera

1. Plug your USB camera into any USB port on your Raspberry Pi.
2. Verify the host sees the device:
   ```bash
   ls -la /dev/video*
   ```
3. Because `docker-compose.yml` mounts `/dev:/dev` in `privileged: true` mode, the container will automatically detect cameras and support hotplugging.
4. Open the Web Dashboard at `http://<YOUR_PI_IP>:3000`.
5. Go to the **Settings** tab -> **USB Camera Setup & Live Data Feed**:
   - Click **Scan USB Devices**.
   - Select your camera (e.g., `/dev/video0`).
   - Click **Test Connection** -> **Apply & Save Camera Setup**.
   - Click **Enable Live Camera Data** to switch the room analytics to real-world camera detection.

---

## 4. Useful Docker Commands

### View Combined Container Logs:
```bash
docker logs -f spatialsense
```

### View Live Streams & Endpoints:
- Web Dashboard: `http://localhost:3000`
- Edge CV MJPEG Stream: `http://localhost:8000/api/camera/stream`
- Edge CV Healthcheck: `http://localhost:8000/api/health`
- Node Healthcheck: `http://localhost:3000/api/health`

### Stop the Container:
```bash
docker compose down
```

### Rebuild from Scratch:
```bash
docker compose build --no-cache
docker compose up -d
```

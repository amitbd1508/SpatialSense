# SpatialSense: Privacy-First Indoor Spatial Intelligence Platform

SpatialSense transforms standard edge hardware (Raspberry Pi 4 / 5 + webcam) into a privacy-preserving indoor spatial intelligence node. It tracks presence, zone transitions, ergonomic sitting vs. standing posture, occupancy metrics, prolonged inactivity, and potential fall incidents—**without uploading raw video to the cloud or storing facial identifiers**.

---

## Architecture Overview

```
                      +-----------------------------+
                      | Hardware Sensors            |
                      | - Webcam (Edge CV)          |
                      | - mmWave Radar (Future V2)  |
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      | Standardized Observation    |
                      | { position, bbox, activity }|
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      | Spatial & Event Engine      |
                      | - Zone Intersection (Desk)  |
                      | - Posture State Machine     |
                      | - Fall & Inactivity Rules   |
                      +--------------+--------------+
                                     |
                    +----------------+----------------+
                    |                                 |
                    v                                 v
     +-----------------------------+   +-----------------------------+
     | Local SQLite / JSON Store   |   | Polished Web Dashboard      |
     | - Anonymous Events          |   | - Live Camera & BBox Wire   |
     | - Spatial Heatmap Trail     |   | - Interactive Zone Editor   |
     | - Daily Metrics             |   | - Real-Time Posture Cards   |
     +-----------------------------+   +-----------------------------+
```

---

## Hardware Requirements

- **Raspberry Pi 4 or 5** (2GB+ RAM recommended)
- **Raspberry Pi Camera Module** (v2/v3) or standard USB webcam (UVC compliant)
- **Local Network / Wi-Fi**
- **Computer / Tablet / Mobile Browser**

---

## Quick Start (Docker — Recommended)

Run everything (OpenCV Edge CV Engine + Web Dashboard + USB Camera) in **one command**:

```bash
# Clone and enter directory
cd spatialsense

# Run with 1 command (builds & starts containers with USB camera pass-through)
./run_docker.sh
```

Or using Docker Compose directly:
```bash
docker compose up --build -d
```

Once started:
* **Web Dashboard**: `http://localhost:3000` (or `http://<YOUR_PI_IP>:3000`)
* **Camera Stream & Edge CV**: `http://localhost:8000` (or `http://<YOUR_PI_IP>:8000`)

---

## Native Setup on Raspberry Pi (Without Docker)

1. Clone or copy project to Raspberry Pi:
   ```bash
   git clone <repo-url> /home/pi/spatialsense
   cd /home/pi/spatialsense
   ```

2. Run automated installer:
   ```bash
   chmod +x scripts/*.sh scripts/*.py
   ./scripts/install.sh
   ```

3. Connect and verify your USB camera:
   ```bash
   # Verify Linux detects the USB webcam
   lsusb

   # Check V4L2 video nodes (usually /dev/video0)
   v4l2-ctl --list-devices

   # Ensure user has video device permissions
   sudo usermod -a -G video $USER

   # Run automated camera capture diagnostic test
   python3 scripts/test_usb_camera.py 0
   ```

4. Start the service:
   ```bash
   ./scripts/start.sh
   ```

5. Enable automatic start on boot (systemd):
   ```bash
   sudo cp scripts/spatialsense.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable spatialsense
   sudo systemctl start spatialsense
   ```

6. Open browser on your computer:
   `http://raspberrypi.local:3000` (or `http://<IP-OF-PI>:3000`)

---

## Viewing the Live Camera Feed

SpatialSense provides three ways to monitor the live feed:

1. **Dashboard Live Monitor (Direct MJPEG Stream)**:
   In the dashboard, open **Live Monitor** and select **Raspberry Pi MJPEG**. Enter your Raspberry Pi's IP (e.g. `http://192.168.1.100:8000`). The dashboard displays the live video stream with real-time bounding box, tracking centroid, and posture indicators.
2. **Direct Browser URL**:
   Open `http://<IP-OF-PI>:8000/api/camera/stream` directly in any web browser on your local network to view the pure MJPEG annotated feed.
3. **Browser Webcam (Zero Raspberry Pi required)**:
   If testing on your laptop before connecting the Raspberry Pi, select **Browser USB Webcam** in the Live Monitor tab. The platform will request access to your laptop webcam and run local edge computer vision directly in the browser via HTML5 Canvas.

---

## Privacy Guardrails (Guaranteed by Design)

- **Zero Cloud Video**: Raw camera frames are analyzed on-device in RAM and instantly discarded.
- **Zero Facial Recognition**: No facial landmarks, identities, emotions, or biometric templates are extracted.
- **Anonymous Session IDs**: People are referenced only by volatile session IDs (`person_001`).
- **Data Minimization**: Only coordinates `(x, y)`, timestamps, zones, and activity states (`SITTING`, `STANDING`, etc.) are persisted.
- **Hot-Swappable mmWave Radar**: Base class `BaseSensor` enables replacing optical cameras with 24GHz/60GHz Doppler radar with zero core logic changes.

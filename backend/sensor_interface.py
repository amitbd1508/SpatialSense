"""
SpatialSense - Abstract Sensor Interface
Enables hot-swapping between Camera, mmWave Radar, and Simulation
without changing the tracking or event pipeline.
"""
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
from pydantic import BaseModel
import time

class SensorObservation(BaseModel):
    timestamp: str
    person_id: Optional[str] = "person_001"
    presence: bool
    position: Dict[str, float]  # Normalized x, y in range [0.0, 1.0]
    bbox: Optional[Dict[str, float]] = None # Normalized x, y, width, height
    activity: str = "UNKNOWN"   # UNKNOWN, STANDING, SITTING, WALKING, LYING, POSSIBLE_FALL
    confidence: float = 0.85
    sensor_type: str = "camera" # "camera", "mmwave", "simulated"
    metadata: Dict[str, Any] = {}

class BaseSensor(ABC):
    @abstractmethod
    def initialize(self) -> bool:
        """Initialize hardware connection, open device or socket."""
        pass

    @abstractmethod
    def read_observation(self) -> Optional[SensorObservation]:
        """Capture one sensory frame/packet and return standardized observation."""
        pass

    @abstractmethod
    def release(self) -> None:
        """Safely close device resources."""
        pass

class CameraSensor(BaseSensor):
    """
    USB Webcam or Raspberry Pi Camera Module (V4L2) sensor implementation.
    Performs on-device contour and bounding-box detection via OpenCV.
    Never uploads raw frames; emits anonymous SensorObservation.
    """
    def __init__(
        self,
        camera_index: int = 0,
        width: int = 640,
        height: int = 480,
        fps: int = 10,
        rotation: int = 0,
        flip_h: bool = False,
        brightness: int = 0,
        contrast: float = 1.0,
        privacy_mode: str = "silhouette_only",
        motion_threshold: int = 1200,
    ):
        self.camera_index = camera_index
        self.width = width
        self.height = height
        self.fps = fps
        self.rotation = rotation
        self.flip_h = flip_h
        self.brightness = brightness
        self.contrast = contrast
        self.privacy_mode = privacy_mode
        self.motion_threshold = motion_threshold
        self.device_name = f"USB Camera (/dev/video{camera_index})"

        self.cap = None
        self.bg_subtractor = None
        self.is_connected = False
        self.last_frame = None
        self.last_observation = None
        self.lock = threading.Lock() if 'threading' in globals() else None

    @staticmethod
    def list_available_cameras():
        """Scans Linux /dev/video* devices and queries metadata."""
        import glob
        import os
        devices = []
        video_paths = sorted(glob.glob("/dev/video*"))

        # Look up device names from sysfs if available on Linux
        for p in video_paths:
            base = os.path.basename(p)
            sys_name_path = f"/sys/class/video4linux/{base}/name"
            card_name = f"USB Video Device ({base})"
            if os.path.exists(sys_name_path):
                try:
                    with open(sys_name_path, "r") as f:
                        name_str = f.read().strip()
                        if name_str:
                            card_name = name_str
                except Exception:
                    pass

            idx = 0
            try:
                idx = int(base.replace("video", ""))
            except ValueError:
                idx = 0

            devices.append({
                "index": idx,
                "devicePath": p,
                "name": card_name,
                "availableResolutions": ["320x240", "640x480", "1280x720", "1920x1080"],
                "isAvailable": True,
            })

        # If no /dev/video found (e.g. running in virtual env/container without camera passed), provide indices
        if not devices:
            devices = [
                {"index": 0, "devicePath": "/dev/video0", "name": "Default USB Camera 0", "availableResolutions": ["640x480", "1280x720"], "isAvailable": False},
                {"index": 1, "devicePath": "/dev/video1", "name": "Secondary USB Camera 1", "availableResolutions": ["640x480", "1280x720"], "isAvailable": False},
                {"index": 2, "devicePath": "/dev/video2", "name": "Auxiliary Camera 2", "availableResolutions": ["640x480"], "isAvailable": False},
            ]
        return devices

    def reconfigure(
        self,
        camera_index: Optional[int] = None,
        width: Optional[int] = None,
        height: Optional[int] = None,
        fps: Optional[int] = None,
        rotation: Optional[int] = None,
        flip_h: Optional[bool] = None,
        brightness: Optional[int] = None,
        contrast: Optional[float] = None,
        privacy_mode: Optional[str] = None,
        motion_threshold: Optional[int] = None,
    ) -> bool:
        """Dynamically reconfigures the camera device, resolution, and filters."""
        needs_reinit = False

        if camera_index is not None and camera_index != self.camera_index:
            self.camera_index = camera_index
            needs_reinit = True

        if width is not None and width != self.width:
            self.width = width
            needs_reinit = True

        if height is not None and height != self.height:
            self.height = height
            needs_reinit = True

        if fps is not None and fps != self.fps:
            self.fps = fps
            needs_reinit = True

        if rotation is not None:
            self.rotation = rotation
        if flip_h is not None:
            self.flip_h = flip_h
        if brightness is not None:
            self.brightness = brightness
        if contrast is not None:
            self.contrast = contrast
        if privacy_mode is not None:
            self.privacy_mode = privacy_mode
        if motion_threshold is not None:
            self.motion_threshold = motion_threshold

        if needs_reinit:
            self.release()
            return self.initialize()
        return True

    def initialize(self) -> bool:
        try:
            import cv2
            print(f"[CameraSensor] Opening USB camera at index {self.camera_index}...")
            # Use V4L2 backend on Linux/Raspberry Pi
            self.cap = cv2.VideoCapture(self.camera_index, cv2.CAP_V4L2)
            if not self.cap.isOpened():
                # Fallback to default backend
                self.cap = cv2.VideoCapture(self.camera_index)
            
            if not self.cap.isOpened():
                print(f"[CameraSensor] Notice: Camera index {self.camera_index} (/dev/video{self.camera_index}) is not currently responding.")
                self.is_connected = False
                return False

            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
            self.cap.set(cv2.CAP_PROP_FPS, self.fps)

            # MOG2 background subtractor for lightweight motion/presence detection
            self.bg_subtractor = cv2.createBackgroundSubtractorMOG2(
                history=300, varThreshold=32, detectShadows=False
            )
            self.is_connected = True
            print(f"[CameraSensor] Successfully initialized USB camera {self.camera_index} ({self.width}x{self.height} @ {self.fps}fps)")
            return True
        except Exception as e:
            print(f"[CameraSensor] Initialization exception: {e}")
            self.is_connected = False
            return False

    def read_observation(self) -> Optional[SensorObservation]:
        if not self.cap or not self.is_connected:
            return None

        import cv2
        ret, frame = self.cap.read()
        if not ret or frame is None:
            return None

        # Apply rotation if configured
        if self.rotation == 90:
            frame = cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE)
        elif self.rotation == 180:
            frame = cv2.rotate(frame, cv2.ROTATE_180)
        elif self.rotation == 270:
            frame = cv2.rotate(frame, cv2.ROTATE_90_COUNTERCLOCKWISE)

        # Apply horizontal flip (mirroring) if requested
        if self.flip_h:
            frame = cv2.flip(frame, 1)

        # Apply contrast & brightness
        if self.contrast != 1.0 or self.brightness != 0:
            frame = cv2.convertScaleAbs(frame, alpha=self.contrast, beta=self.brightness)

        # Resize for consistent, deterministic processing
        frame = cv2.resize(frame, (self.width, self.height))
        self.last_frame = frame.copy()

        # Apply background subtraction
        fg_mask = self.bg_subtractor.apply(frame)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, kernel)
        fg_mask = cv2.dilate(fg_mask, kernel, iterations=2)

        contours, _ = cv2.findContours(fg_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        max_contour = None
        max_area = 0
        for c in contours:
            area = cv2.contourArea(c)
            if area > max_area and area > self.motion_threshold:
                max_area = area
                max_contour = c

        iso_now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        if max_contour is not None:
            x, y, w, h = cv2.boundingRect(max_contour)
            norm_x = x / float(self.width)
            norm_y = y / float(self.height)
            norm_w = w / float(self.width)
            norm_h = h / float(self.height)
            norm_cx = norm_x + norm_w / 2.0
            norm_cy = norm_y + norm_h / 2.0

            aspect_ratio = norm_w / max(0.001, norm_h)
            activity = "STANDING"
            if aspect_ratio > 1.2 and norm_cy > 0.65:
                activity = "POSSIBLE_FALL"
            elif aspect_ratio >= 0.55:
                activity = "SITTING"
            elif norm_w > 0.15 and norm_h > 0.40:
                activity = "WALKING"

            obs = SensorObservation(
                timestamp=iso_now,
                person_id="person_001",
                presence=True,
                position={"x": round(norm_cx, 3), "y": round(norm_cy, 3)},
                bbox={"x": round(norm_x, 3), "y": round(norm_y, 3), "width": round(norm_w, 3), "height": round(norm_h, 3)},
                activity=activity,
                confidence=0.92,
                sensor_type="camera",
                metadata={"area": int(max_area), "aspect_ratio": round(aspect_ratio, 2)}
            )
            self.last_observation = obs
            return obs
        else:
            obs = SensorObservation(
                timestamp=iso_now,
                person_id=None,
                presence=False,
                position={"x": 0.5, "y": 0.5},
                activity="UNKNOWN",
                confidence=0.90,
                sensor_type="camera"
            )
            self.last_observation = obs
            return obs

    def get_annotated_jpeg(self) -> Optional[bytes]:
        """
        Generates privacy-preserving annotated frame for local browser preview.
        Draws bounding box, center point, and anonymized silhouette.
        """
        if self.last_frame is None:
            return None
        import cv2

        preview = self.last_frame.copy()

        # Handle privacy mode styles
        if self.privacy_mode == "wireframe_only":
            # Black background with green HUD
            preview[:] = (10, 12, 16)
        elif self.privacy_mode == "silhouette_only":
            # Privacy shadow mask
            preview = cv2.convertScaleAbs(preview, alpha=0.35, beta=10)
        # else "full_vision" uses normal frame

        obs = self.last_observation
        if obs and obs.presence and obs.bbox:
            x = int(obs.bbox['x'] * self.width)
            y = int(obs.bbox['y'] * self.height)
            w = int(obs.bbox['width'] * self.width)
            h = int(obs.bbox['height'] * self.height)
            cx = int(obs.position['x'] * self.width)
            cy = int(obs.position['y'] * self.height)

            color = (0, 255, 120) if obs.activity != "POSSIBLE_FALL" else (0, 0, 255)
            if obs.activity == "SITTING":
                color = (255, 165, 0) # Sky blue in BGR

            # Draw HUD bounding box & centroid
            cv2.rectangle(preview, (x, y), (x + w, y + h), color, 2)
            cv2.circle(preview, (cx, cy), 6, (255, 255, 255), -1)
            cv2.circle(preview, (cx, cy), 8, color, 1)

            # Draw HUD posture tag
            label = f"ID: {obs.person_id} [{obs.activity}]"
            cv2.putText(preview, label, (x, max(20, y - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

        # Draw timestamp and camera index in corner
        hud_info = f"CAM {self.camera_index} ({self.width}x{self.height} @ {self.fps}fps)"
        cv2.putText(preview, hud_info, (10, self.height - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (160, 160, 160), 1)

        ret, buffer = cv2.imencode('.jpg', preview, [int(cv2.IMWRITE_JPEG_QUALITY), 65])
        if ret:
            return buffer.tobytes()
        return None

    def release(self) -> None:
        if self.cap and self.cap.isOpened():
            self.cap.release()
        self.is_connected = False
        print(f"[CameraSensor] Released camera device index {self.camera_index}")


class MmWaveSensor(BaseSensor):
    """
    mmWave Radar sensor abstraction (e.g. TI IWR6843 or Seeed 24GHz/60GHz radar).
    Consumes point-cloud Doppler clusters and converts to normalized room coordinates.
    Zero optical cameras required.
    """
    def __init__(self, port: str = "/dev/ttyUSB0", baudrate: int = 921600):
        self.port = port
        self.baudrate = baudrate
        self.is_connected = False

    def initialize(self) -> bool:
        # In hardware deployment, open serial connection
        print(f"[mmWave] Initializing radar interface on {self.port} at {self.baudrate} baud...")
        self.is_connected = True
        return True

    def read_observation(self) -> Optional[SensorObservation]:
        # mmWave radar outputs 3D points (x, y, z) + radial velocity directly
        # Example transformed to standardized observation
        return None

    def release(self) -> None:
        self.is_connected = False
        print("[mmWave] Released radar connection")

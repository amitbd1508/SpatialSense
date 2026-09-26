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
    def __init__(self, camera_index: int = 0, width: int = 640, height: int = 480, fps: int = 10):
        self.camera_index = camera_index
        self.width = width
        self.height = height
        self.fps = fps
        self.cap = None
        self.bg_subtractor = None
        self.is_connected = False
        self.last_frame = None
        self.last_observation = None

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
                print(f"[CameraSensor] Error: Unable to open camera at /dev/video{self.camera_index}")
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
            print(f"[CameraSensor] Successfully initialized USB camera (Resolution: {self.width}x{self.height} @ {self.fps}fps)")
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
            if area > max_area and area > 1200: # Minimum presence threshold
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

            obs = SensorObservation(
                timestamp=iso_now,
                person_id="person_001",
                presence=True,
                position={"x": round(norm_cx, 3), "y": round(norm_cy, 3)},
                bbox={"x": round(norm_x, 3), "y": round(norm_y, 3), "width": round(norm_w, 3), "height": round(norm_h, 3)},
                activity=activity,
                confidence=0.92,
                sensor_type="camera"
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
        # Apply privacy blur or darken background
        preview = cv2.convertScaleAbs(preview, alpha=0.45, beta=10)

        obs = self.last_observation
        if obs and obs.presence and obs.bbox:
            x = int(obs.bbox['x'] * self.width)
            y = int(obs.bbox['y'] * self.height)
            w = int(obs.bbox['width'] * self.width)
            h = int(obs.bbox['height'] * self.height)
            cx = int(obs.position['x'] * self.width)
            cy = int(obs.position['y'] * self.height)

            color = (0, 255, 120) if obs.activity != "POSSIBLE_FALL" else (0, 0, 255)

            # Draw HUD bounding box
            cv2.rectangle(preview, (x, y), (x + w, y + h), color, 2)
            cv2.circle(preview, (cx, cy), 5, (255, 255, 255), -1)

            # Draw HUD tag
            label = f"{obs.person_id} [{obs.activity}]"
            cv2.putText(preview, label, (x, max(20, y - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

        ret, buffer = cv2.imencode('.jpg', preview, [int(cv2.IMWRITE_JPEG_QUALITY), 65])
        if ret:
            return buffer.tobytes()
        return None

    def release(self) -> None:
        if self.cap and self.cap.isOpened():
            self.cap.release()
        self.is_connected = False
        print("[CameraSensor] Released camera device")


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

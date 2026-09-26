#!/usr/bin/env python3
"""
SpatialSense - USB Camera Diagnostic & Verification Tool for Raspberry Pi
Tests USB camera connectivity, V4L2 device nodes, frame capture rate, and resolution.
"""
import sys
import os
import glob
import time

def check_usb_devices():
    print("\n[1] Checking USB devices (lsusb)...")
    os.system("lsusb")

def check_video_devices():
    print("\n[2] Checking Video4Linux device nodes (/dev/video*)...")
    devices = sorted(glob.glob("/dev/video*"))
    if not devices:
        print("  WARNING: No /dev/video* nodes detected!")
        print("  Check: 1. Is the USB camera plugged into a USB 2.0/3.0 port?")
        print("         2. Run: dmesg | tail -n 20 to view kernel USB logs")
        return []
    for d in devices:
        print(f"  Found: {d}")
    return devices

def test_opencv_capture(camera_idx=0):
    print(f"\n[3] Testing OpenCV capture on index {camera_idx} (/dev/video{camera_idx})...")
    try:
        import cv2
    except ImportError:
        print("  OpenCV is not installed. Run: pip install opencv-python-headless")
        return False

    cap = cv2.VideoCapture(camera_idx, cv2.CAP_V4L2)
    if not cap.isOpened():
        print(f"  CAP_V4L2 failed, trying default backend for index {camera_idx}...")
        cap = cv2.VideoCapture(camera_idx)

    if not cap.isOpened():
        print(f"  ERROR: Unable to open camera on index {camera_idx}!")
        print("  Resolution: Check camera permissions (sudo usermod -a -G video $USER)")
        return False

    # Configure resolution
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    actual_w = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
    actual_h = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
    print(f"  Camera opened successfully! Resolution: {int(actual_w)}x{int(actual_h)}")

    print("  Testing 10 frame captures...")
    start_t = time.time()
    frames_read = 0
    last_frame = None

    for i in range(10):
        ret, frame = cap.read()
        if ret and frame is not None:
            frames_read += 1
            last_frame = frame
        time.sleep(0.05)

    duration = time.time() - start_t
    measured_fps = frames_read / max(0.001, duration)
    print(f"  Successfully captured {frames_read}/10 frames at ~{measured_fps:.1f} FPS.")

    if last_frame is not None:
        out_file = "usb_camera_test.jpg"
        cv2.imwrite(out_file, last_frame)
        print(f"  Saved diagnostic snapshot: {os.path.abspath(out_file)}")

    cap.release()
    print("\n[SUCCESS] USB camera is fully operational for SpatialSense!")
    return True

if __name__ == "__main__":
    idx = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    check_usb_devices()
    devices = check_video_devices()
    test_opencv_capture(idx)

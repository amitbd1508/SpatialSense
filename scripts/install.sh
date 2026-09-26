#!/usr/bin/env bash
# SpatialSense - Automated Setup Script for Raspberry Pi (Debian/Raspbian Bullseye & Bookworm)
set -e

echo "=========================================================="
echo "    SpatialSense: Privacy-First Spatial Intelligence      "
echo "             Raspberry Pi Setup & Deployment              "
echo "=========================================================="

echo "[1/4] Updating package lists and installing core dependencies..."
sudo apt-get update
sudo apt-get install -y python3-pip python3-venv libgl1-mesa-glx libglib2.0-0 v4l-utils

echo "[2/4] Setting up Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

echo "[3/4] Installing Python requirements..."
pip install --upgrade pip
pip install -r backend/requirements.txt

echo "[4/4] Configuring camera permissions..."
sudo usermod -a -G video $USER

echo "Setup completed successfully!"
echo "To start SpatialSense edge engine, run: ./scripts/start.sh"

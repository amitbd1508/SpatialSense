import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  RefreshCw,
  Video,
  Settings,
  Sliders,
  RotateCw,
  FlipHorizontal,
  Shield,
  Activity,
  Check,
  AlertTriangle,
  Play,
  Monitor,
  Maximize2,
  Radio,
  Eye,
  SlidersHorizontal,
  Zap,
} from 'lucide-react';
import { CameraDevice, CameraConfig, RoomSettings, RoomStatus } from '../types/index.ts';
import { api } from '../api.ts';

interface UsbCameraSetupProps {
  settings: RoomSettings | null;
  onSettingsSaved: (updated: RoomSettings) => void;
  status: RoomStatus | null;
}

export const UsbCameraSetup: React.FC<UsbCameraSetupProps> = ({
  settings,
  onSettingsSaved,
  status,
}) => {
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState<boolean>(false);
  const [testingDevice, setTestingDevice] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ can_open: boolean; status: string } | null>(null);
  const [savingConfig, setSavingConfig] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [streamKey, setStreamKey] = useState<number>(Date.now());
  const [previewSource, setPreviewSource] = useState<'pi_stream' | 'browser_webcam'>('pi_stream');

  // Camera config state
  const [config, setConfig] = useState<CameraConfig>({
    cameraIndex: settings?.cameraConfig?.cameraIndex ?? settings?.cameraIndex ?? 0,
    devicePath: settings?.cameraConfig?.devicePath ?? `/dev/video${settings?.cameraIndex ?? 0}`,
    width: settings?.cameraConfig?.width ?? 640,
    height: settings?.cameraConfig?.height ?? 480,
    fps: settings?.cameraConfig?.fps ?? settings?.fps ?? 10,
    rotation: settings?.cameraConfig?.rotation ?? 0,
    flipHorizontal: settings?.cameraConfig?.flipHorizontal ?? false,
    brightness: settings?.cameraConfig?.brightness ?? 0,
    contrast: settings?.cameraConfig?.contrast ?? 1.0,
    privacyMode: settings?.cameraConfig?.privacyMode ?? 'silhouette_only',
    motionThreshold: settings?.cameraConfig?.motionThreshold ?? 1200,
  });

  // Browser webcam stream reference
  const browserVideoRef = useRef<HTMLVideoElement | null>(null);
  const [browserWebcamActive, setBrowserWebcamActive] = useState<boolean>(false);

  // Load available devices on mount
  const scanDevices = async () => {
    try {
      setIsLoadingDevices(true);
      const res = await api.getCameraDevices();
      setDevices(res.devices);
      if (res.devices.length > 0 && !res.devices.some((d) => d.index === config.cameraIndex)) {
        const first = res.devices[0];
        setConfig((prev) => ({
          ...prev,
          cameraIndex: first.index,
          devicePath: first.devicePath,
        }));
      }
    } catch (err) {
      console.warn('Could not fetch hardware camera list:', err);
    } finally {
      setIsLoadingDevices(false);
    }
  };

  useEffect(() => {
    scanDevices();
  }, []);

  // Browser webcam preview toggle
  useEffect(() => {
    if (previewSource === 'browser_webcam') {
      let stream: MediaStream | null = null;
      navigator.mediaDevices
        ?.getUserMedia({ video: { width: config.width, height: config.height } })
        .then((s) => {
          stream = s;
          if (browserVideoRef.current) {
            browserVideoRef.current.srcObject = s;
            browserVideoRef.current.play();
            setBrowserWebcamActive(true);
          }
        })
        .catch((e) => {
          console.error('Browser webcam error:', e);
          setBrowserWebcamActive(false);
          setPreviewSource('pi_stream');
        });

      return () => {
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
        setBrowserWebcamActive(false);
      };
    }
  }, [previewSource, config.width, config.height]);

  const handleTestDevice = async () => {
    try {
      setTestingDevice(true);
      setTestResult(null);
      const res = await api.testCameraDevice(config.cameraIndex);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ can_open: false, status: 'error' });
    } finally {
      setTestingDevice(false);
    }
  };

  const handleApplyConfig = async () => {
    try {
      setSavingConfig(true);
      setSaveMessage(null);

      // 1. Update camera backend config
      await api.updateCameraConfig(config);

      // 2. Update room settings
      const updatedSettings: Partial<RoomSettings> = {
        cameraIndex: config.cameraIndex,
        fps: config.fps,
        privacyMode: config.privacyMode as any,
        cameraConfig: config,
      };
      const saved = await api.updateSettings(updatedSettings);
      onSettingsSaved(saved);

      // 3. Refresh live stream frame
      setStreamKey(Date.now());
      setSaveMessage('Camera configuration saved & live capture restarted!');
      setTimeout(() => setSaveMessage(null), 4000);
    } catch (err: any) {
      setSaveMessage(`Error: ${err.message || 'Failed to apply configuration'}`);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSwitchToLiveCameraMode = async () => {
    try {
      setSavingConfig(true);
      const saved = await api.updateSettings({
        activeSensor: 'camera',
        cameraIndex: config.cameraIndex,
        cameraConfig: config,
      });
      onSettingsSaved(saved);
      setSaveMessage('Switched system to Live Optical Camera mode! Room dashboard is now processing real live data.');
      setTimeout(() => setSaveMessage(null), 5000);
    } catch (err: any) {
      setSaveMessage('Failed to switch to camera sensor mode.');
    } finally {
      setSavingConfig(false);
    }
  };

  const isLiveCameraActive = settings?.activeSensor === 'camera';
  const currentActivity = status?.currentActivity || 'UNKNOWN';

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
              <span>USB Camera Setup & Live Data Feed</span>
              {isLiveCameraActive ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  LIVE DATA ACTIVE
                </span>
              ) : (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  SIMULATION ACTIVE
                </span>
              )}
            </h3>
            <p className="text-xs text-neutral-400">
              Select USB webcam node, calibrate resolution/orientation, and stream real-time spatial telemetry.
            </p>
          </div>
        </div>

        {/* Scan & Live Mode Switch */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={scanDevices}
            disabled={isLoadingDevices}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700 transition-colors"
            title="Scan for connected V4L2 USB cameras"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDevices ? 'animate-spin' : ''}`} />
            <span>Scan USB Devices</span>
          </button>

          {!isLiveCameraActive && (
            <button
              type="button"
              onClick={handleSwitchToLiveCameraMode}
              disabled={savingConfig}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm shadow-emerald-950 transition-colors"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Enable Live Camera Data</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Settings & Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Device Selection & Settings (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* 1. USB Camera Device Dropdown */}
          <div>
            <label className="text-xs font-medium text-neutral-300 block mb-1.5">
              Select USB Camera Device
            </label>
            <div className="relative">
              <select
                value={config.cameraIndex}
                onChange={(e) => {
                  const idx = Number(e.target.value);
                  const selectedDev = devices.find((d) => d.index === idx);
                  setConfig({
                    ...config,
                    cameraIndex: idx,
                    devicePath: selectedDev?.devicePath || `/dev/video${idx}`,
                  });
                }}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-emerald-500 font-mono"
              >
                {devices.length > 0 ? (
                  devices.map((dev) => (
                    <option key={dev.index} value={dev.index}>
                      {dev.name} ({dev.devicePath})
                    </option>
                  ))
                ) : (
                  <>
                    <option value={0}>Primary USB Webcam (/dev/video0)</option>
                    <option value={1}>Secondary USB Camera (/dev/video1)</option>
                    <option value={2}>Auxiliary Camera Node (/dev/video2)</option>
                  </>
                )}
              </select>
            </div>
            <div className="flex items-center justify-between mt-1 text-[11px] text-neutral-400">
              <span>Node: {config.devicePath}</span>
              <button
                type="button"
                onClick={handleTestDevice}
                disabled={testingDevice}
                className="text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
              >
                {testingDevice ? 'Probing...' : 'Test Connection'}
              </button>
            </div>

            {testResult && (
              <div
                className={`mt-2 p-2 rounded-lg text-xs flex items-center gap-2 border ${
                  testResult.can_open
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                }`}
              >
                {testResult.can_open ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Camera at /dev/video{config.cameraIndex} is connected and ready!</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>Could not acquire frame. Verify USB cable or Linux permissions.</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 2. Resolution & FPS */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-neutral-400 block mb-1">Capture Resolution</label>
              <select
                value={`${config.width}x${config.height}`}
                onChange={(e) => {
                  const [w, h] = e.target.value.split('x').map(Number);
                  setConfig({ ...config, width: w, height: h });
                }}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500 font-mono"
              >
                <option value="640x480">640 x 480 (Recommended)</option>
                <option value="1280x720">1280 x 720 (HD 720p)</option>
                <option value="320x240">320 x 240 (Ultra Fast)</option>
                <option value="1920x1080">1920 x 1080 (FHD)</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-neutral-400 block mb-1">Target FPS</label>
              <select
                value={config.fps}
                onChange={(e) => setConfig({ ...config, fps: Number(e.target.value) })}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500 font-mono"
              >
                <option value={5}>5 FPS (Low Power)</option>
                <option value={10}>10 FPS (Optimal Pi)</option>
                <option value={15}>15 FPS (Smooth)</option>
                <option value={30}>30 FPS (High Speed)</option>
              </select>
            </div>
          </div>

          {/* 3. Orientation & Mirroring */}
          <div>
            <label className="text-xs text-neutral-400 block mb-1">Camera Mounting & Rotation</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { rot: 0, label: '0° Normal' },
                { rot: 90, label: '90° Right' },
                { rot: 180, label: '180° Invert' },
                { rot: 270, label: '270° Left' },
              ].map((item) => (
                <button
                  type="button"
                  key={item.rot}
                  onClick={() => setConfig({ ...config, rotation: item.rot as any })}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-medium border text-center transition-colors ${
                    config.rotation === item.rot
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Horizontal Mirroring & Privacy Filter */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => setConfig({ ...config, flipHorizontal: !config.flipHorizontal })}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${
                config.flipHorizontal
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <FlipHorizontal className="w-3.5 h-3.5" />
              <span>Mirror: {config.flipHorizontal ? 'ON' : 'OFF'}</span>
            </button>

            <div>
              <select
                value={config.privacyMode}
                onChange={(e) => setConfig({ ...config, privacyMode: e.target.value as any })}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-2 text-xs text-neutral-200 focus:outline-none"
              >
                <option value="silhouette_only">Silhouette Shield</option>
                <option value="wireframe_only">Wireframe Only</option>
                <option value="full_vision">Full Vision (Test)</option>
              </select>
            </div>
          </div>

          {/* Motion Sensitivity Threshold */}
          <div>
            <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
              <span>Motion Detection Sensitivity</span>
              <span className="font-mono text-neutral-300">{config.motionThreshold} px²</span>
            </div>
            <input
              type="range"
              min="400"
              max="3500"
              step="100"
              value={config.motionThreshold}
              onChange={(e) => setConfig({ ...config, motionThreshold: Number(e.target.value) })}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-neutral-500 mt-0.5">
              <span>High Sensitivity (Smaller movements)</span>
              <span>Low Sensitivity (Filter noise)</span>
            </div>
          </div>

          {/* Save / Apply Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleApplyConfig}
              disabled={savingConfig}
              className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm shadow-emerald-950 transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>{savingConfig ? 'Applying & Re-initializing...' : 'Apply & Save Camera Setup'}</span>
            </button>
            {saveMessage && (
              <p className="text-xs text-emerald-400 text-center mt-2 font-medium">
                {saveMessage}
              </p>
            )}
          </div>
        </div>

        {/* Right Side: Interactive Live View & Live Telemetry Inspector (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-xs font-semibold text-neutral-200">
                Live Camera Feed (Edge MJPEG Stream)
              </span>
            </div>

            {/* Source switch: Pi MJPEG Stream vs Browser Webcam */}
            <div className="flex items-center gap-1 bg-neutral-950 p-0.5 rounded-lg border border-neutral-800 text-[11px]">
              <button
                type="button"
                onClick={() => setPreviewSource('pi_stream')}
                className={`px-2 py-0.5 rounded font-medium transition-colors ${
                  previewSource === 'pi_stream'
                    ? 'bg-neutral-800 text-emerald-400'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Pi USB Camera
              </button>
              <button
                type="button"
                onClick={() => setPreviewSource('browser_webcam')}
                className={`px-2 py-0.5 rounded font-medium transition-colors ${
                  previewSource === 'browser_webcam'
                    ? 'bg-neutral-800 text-emerald-400'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Browser Webcam
              </button>
            </div>
          </div>

          {/* Video Container */}
          <div className="relative aspect-video w-full bg-black rounded-xl overflow-hidden border border-neutral-800 flex items-center justify-center shadow-inner">
            {previewSource === 'pi_stream' ? (
              <img
                key={streamKey}
                src={`/api/camera/stream?t=${streamKey}`}
                alt="Live Edge Camera Stream"
                className="w-full h-full object-contain"
                onError={() => {
                  // Fallback visual if stream is not yet initiated
                }}
              />
            ) : (
              <video
                ref={browserVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            )}

            {/* Live Badges Overlay */}
            <div className="absolute top-2.5 left-2.5 flex items-center gap-2">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded shadow ${
                  currentActivity === 'POSSIBLE_FALL'
                    ? 'bg-rose-600 text-white'
                    : currentActivity === 'SITTING'
                    ? 'bg-sky-600 text-white'
                    : currentActivity === 'WALKING'
                    ? 'bg-purple-600 text-white'
                    : 'bg-emerald-600 text-white'
                }`}
              >
                {currentActivity}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/70 text-neutral-300 border border-neutral-700/50 backdrop-blur-xs">
                {status?.isOccupied ? 'PERSON DETECTED' : 'VACANT'}
              </span>
            </div>

            <div className="absolute top-2.5 right-2.5 text-[10px] font-mono text-neutral-400 bg-black/70 px-2 py-0.5 rounded border border-neutral-700/50 backdrop-blur-xs">
              {config.width}x{config.height} @ {config.fps}fps
            </div>

            {/* Bottom HUD: Position & Zone */}
            <div className="absolute bottom-2.5 left-2.5 right-2.5 bg-neutral-950/85 backdrop-blur-xs border border-neutral-800/80 rounded-lg px-3 py-1.5 flex items-center justify-between text-xs font-mono text-neutral-300">
              <div className="flex items-center gap-2 truncate">
                <span className="text-neutral-500">Zone:</span>
                <span className="text-emerald-400 font-semibold truncate">
                  {status?.currentZone?.name || 'Open Area'}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span>
                  X:{status?.position?.x ? status.position.x.toFixed(2) : '0.50'} Y:
                  {status?.position?.y ? status.position.y.toFixed(2) : '0.50'}
                </span>
                <span className="text-neutral-500">|</span>
                <span className="text-sky-400">{config.privacyMode.replace('_', ' ')}</span>
              </div>
            </div>
          </div>

          {/* Real-time Telemetry Data Cards */}
          <div className="grid grid-cols-3 gap-2.5 pt-1">
            <div className="bg-neutral-950/80 border border-neutral-800/80 rounded-lg p-2.5">
              <div className="text-[10px] text-neutral-500 uppercase font-mono">Activity State</div>
              <div className="text-xs font-semibold text-neutral-200 mt-0.5 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>{currentActivity}</span>
              </div>
            </div>

            <div className="bg-neutral-950/80 border border-neutral-800/80 rounded-lg p-2.5">
              <div className="text-[10px] text-neutral-500 uppercase font-mono">Spatial Centroid</div>
              <div className="text-xs font-mono font-semibold text-neutral-200 mt-0.5">
                {status?.position
                  ? `(${status.position.x.toFixed(2)}, ${status.position.y.toFixed(2)})`
                  : '(0.50, 0.50)'}
              </div>
            </div>

            <div className="bg-neutral-950/80 border border-neutral-800/80 rounded-lg p-2.5">
              <div className="text-[10px] text-neutral-500 uppercase font-mono">Bounding Wireframe</div>
              <div className="text-xs font-mono font-semibold text-neutral-200 mt-0.5">
                {status?.bbox
                  ? `${Math.round(status.bbox.width * 100)}% × ${Math.round(
                      status.bbox.height * 100
                    )}%`
                  : '16% × 26%'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

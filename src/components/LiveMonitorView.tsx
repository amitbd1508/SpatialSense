import React, { useRef, useState, useEffect } from 'react';
import {
  Video,
  Camera,
  Play,
  Pause,
  AlertTriangle,
  Layers,
  ShieldCheck,
  RefreshCw,
  Eye,
  Activity,
  Sliders,
  Terminal,
  Cpu,
  ExternalLink,
} from 'lucide-react';
import { RoomStatus, Zone, StandardObservation, ActivityType } from '../types/index.ts';
import { formatDuration } from '../utils.ts';
import { api } from '../api.ts';

interface LiveMonitorViewProps {
  status: RoomStatus | null;
  zones: Zone[];
  onSimulateFall: () => void;
  isSimulating: boolean;
}

export const LiveMonitorView: React.FC<LiveMonitorViewProps> = ({
  status,
  zones,
  onSimulateFall,
  isSimulating,
}) => {
  const [feedMode, setFeedMode] = useState<'simulated' | 'webcam' | 'pi_mjpeg'>('simulated');
  const [webcamActive, setWebcamActive] = useState<boolean>(false);
  const [privacyStyle, setPrivacyStyle] = useState<'silhouette' | 'bbox_only' | 'wireframe'>('silhouette');
  const [showZones, setShowZones] = useState<boolean>(true);
  const [piHost, setPiHost] = useState<string>('http://raspberrypi.local:8000');
  const [showPiSetupHelp, setShowPiSetupHelp] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cvIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Start Browser Webcam
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setWebcamActive(true);
        setFeedMode('webcam');
        startLocalCVPipeline();
      }
    } catch (err) {
      console.warn('Could not access webcam:', err);
      setFeedMode('simulated');
    }
  };

  const stopWebcam = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    if (cvIntervalRef.current) {
      clearInterval(cvIntervalRef.current);
      cvIntervalRef.current = null;
    }
    setWebcamActive(false);
  };

  // Local lightweight CV processing loop for browser webcam
  const startLocalCVPipeline = () => {
    if (cvIntervalRef.current) clearInterval(cvIntervalRef.current);

    cvIntervalRef.current = setInterval(() => {
      if (!videoRef.current || !canvasRef.current || videoRef.current.readyState < 2) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = 640;
      canvas.height = 480;
      ctx.drawImage(video, 0, 0, 640, 480);

      // Lightweight luminance and frame difference detection
      const imgData = ctx.getImageData(0, 0, 640, 480);
      const data = imgData.data;

      let minX = 640, maxX = 0, minY = 480, maxY = 0;
      let totalMass = 0;
      let sumX = 0, sumY = 0;

      for (let y = 0; y < 480; y += 4) {
        for (let x = 0; x < 640; x += 4) {
          const idx = (y * 640 + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const brightness = (r + g + b) / 3;

          if (brightness < 120 || brightness > 220) {
            totalMass++;
            sumX += x;
            sumY += y;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      const hasSubject = totalMass > 1500;
      if (hasSubject) {
        const normCx = sumX / (totalMass * 640);
        const normCy = sumY / (totalMass * 480);
        const normW = Math.max(0.12, (maxX - minX) / 640);
        const normH = Math.max(0.18, (maxY - minY) / 480);

        const aspect = normW / normH;
        let detectedAct: ActivityType = 'STANDING';
        if (aspect > 1.2 && normCy > 0.6) {
          detectedAct = 'POSSIBLE_FALL';
        } else if (aspect >= 0.65) {
          detectedAct = 'SITTING';
        }

        const obs: StandardObservation = {
          timestamp: new Date().toISOString(),
          person_id: 'person_001',
          position: { x: normCx, y: normCy },
          bbox: {
            x: Math.max(0, normCx - normW / 2),
            y: Math.max(0, normCy - normH / 2),
            width: normW,
            height: normH,
          },
          presence: true,
          activity: detectedAct,
          confidence: 0.91,
          sensor_source: 'webcam_local_cv',
        };

        api.postObservation(obs).catch(() => {});
      }
    }, 200); // 5 FPS processing loop
  };

  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, []);

  const currentZone = status?.currentZone;
  const currentActivity = status?.currentActivity || 'UNKNOWN';
  const personBbox = status?.bbox;

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        {/* Input Source Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400">Camera / Feed:</span>
          <div className="flex items-center p-1 bg-neutral-950 rounded-lg border border-neutral-800">
            <button
              onClick={() => {
                stopWebcam();
                setFeedMode('simulated');
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                feedMode === 'simulated'
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Demo Simulation
            </button>
            <button
              onClick={startWebcam}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                feedMode === 'webcam'
                  ? 'bg-emerald-600 text-white'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Browser USB Webcam</span>
            </button>
            <button
              onClick={() => {
                stopWebcam();
                setFeedMode('pi_mjpeg');
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                feedMode === 'pi_mjpeg'
                  ? 'bg-sky-600 text-white'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Raspberry Pi MJPEG</span>
            </button>
          </div>
        </div>

        {/* Display Overlay Toggles & USB Guide button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPiSetupHelp(!showPiSetupHelp)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              showPiSetupHelp
                ? 'bg-amber-600/20 border-amber-600/50 text-amber-300'
                : 'border-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-amber-400" />
            <span>USB Cam Setup Guide</span>
          </button>

          <button
            onClick={() => setShowZones(!showZones)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              showZones
                ? 'bg-neutral-800 border-neutral-700 text-neutral-200'
                : 'border-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Zones Overlay</span>
          </button>

          {/* Privacy Visual Mode */}
          <div className="flex items-center gap-1 text-xs text-neutral-400">
            <span>Visual:</span>
            <select
              value={privacyStyle}
              onChange={(e) => setPrivacyStyle(e.target.value as any)}
              className="bg-neutral-950 border border-neutral-800 text-neutral-200 rounded px-2 py-1 text-xs focus:outline-none"
            >
              <option value="silhouette">Anonymous Silhouette</option>
              <option value="bbox_only">Bounding Box Wire</option>
              <option value="wireframe">Abstract Centroid</option>
            </select>
          </div>
        </div>
      </div>

      {/* Raspberry Pi USB Camera Setup Helper Accordion */}
      {showPiSetupHelp && (
        <div className="bg-neutral-900 border border-amber-800/60 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-amber-400" />
              <h4 className="text-sm font-semibold text-neutral-100">
                How to Connect & Test a USB Camera on Raspberry Pi
              </h4>
            </div>
            <span className="text-xs text-amber-400 font-mono">v4l2 / OpenCV</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800 space-y-1.5">
              <span className="font-semibold text-neutral-200 block">1. Plug in USB Camera</span>
              <p className="text-neutral-400">
                Plug your USB webcam into any blue USB 3.0 or black USB 2.0 port on the Raspberry Pi 4/5.
              </p>
              <div className="bg-neutral-900 p-2 rounded font-mono text-[11px] text-emerald-400">
                lsusb
              </div>
            </div>

            <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800 space-y-1.5">
              <span className="font-semibold text-neutral-200 block">2. Verify /dev/video* Node</span>
              <p className="text-neutral-400">
                Confirm Linux detected the video interface (typically <code>/dev/video0</code>):
              </p>
              <div className="bg-neutral-900 p-2 rounded font-mono text-[11px] text-emerald-400">
                v4l2-ctl --list-devices
              </div>
            </div>

            <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800 space-y-1.5">
              <span className="font-semibold text-neutral-200 block">3. Run Automated Diagnostic</span>
              <p className="text-neutral-400">
                Run our diagnostic script to test capture, FPS, and take a test snapshot:
              </p>
              <div className="bg-neutral-900 p-2 rounded font-mono text-[11px] text-emerald-400">
                python3 scripts/test_usb_camera.py
              </div>
            </div>
          </div>

          {feedMode === 'pi_mjpeg' && (
            <div className="pt-2 flex flex-wrap items-center gap-3 border-t border-neutral-800">
              <span className="text-xs text-neutral-400">Raspberry Pi Host URL:</span>
              <input
                type="text"
                value={piHost}
                onChange={(e) => setPiHost(e.target.value)}
                placeholder="http://192.168.1.100:8000"
                className="bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1 text-xs text-neutral-200 font-mono w-64 focus:outline-none focus:border-sky-500"
              />
              <span className="text-[11px] text-neutral-400">
                Stream endpoint: <code>{piHost}/api/camera/stream</code>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Main Viewport Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Primary Camera / Simulation Viewport (3 cols) */}
        <div className="lg:col-span-3 bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden flex flex-col">
          <div className="p-3 border-b border-neutral-800 flex items-center justify-between text-xs text-neutral-400 bg-neutral-950/60">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-neutral-200">
                {feedMode === 'webcam'
                  ? 'Browser USB Webcam (Local HTML5 & Canvas CV)'
                  : feedMode === 'pi_mjpeg'
                  ? `Raspberry Pi USB Camera Stream (${piHost})`
                  : 'Monitored Room Floorplan View'}
              </span>
              <span aria-hidden="true">·</span>
              <span>Anonymous Tracking ID: {status?.currentPersonId || 'None'}</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Zero Raw Cloud Stream</span>
            </div>
          </div>

          {/* The Visual Stage */}
          <div className="relative aspect-16/10 w-full bg-neutral-950 overflow-hidden flex items-center justify-center">
            {/* Real Browser Webcam Video element */}
            <video
              ref={videoRef}
              playsInline
              muted
              className={`absolute inset-0 w-full h-full object-cover transition-opacity ${
                feedMode === 'webcam' ? 'opacity-40 filter grayscale contrast-125' : 'hidden'
              }`}
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Raspberry Pi MJPEG Live Stream */}
            {feedMode === 'pi_mjpeg' && (
              <img
                src={`${piHost}/api/camera/stream`}
                alt="Raspberry Pi USB Camera Live Stream"
                className="absolute inset-0 w-full h-full object-contain"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            )}

            {/* Pi Stream Fallback Container if connection fails */}
            {feedMode === 'pi_mjpeg' && (
              <div className="hidden flex-col items-center justify-center p-6 text-center text-xs text-neutral-400">
                <Camera className="w-8 h-8 text-neutral-500 mb-2" />
                <p className="font-semibold text-neutral-300">
                  Waiting for Raspberry Pi USB camera stream...
                </p>
                <p className="mt-1 text-neutral-400">
                  Make sure <code>python3 backend/main.py</code> is running on your Raspberry Pi at{' '}
                  <span className="text-sky-400 font-mono">{piHost}</span>.
                </p>
              </div>
            )}

            {/* Simulated Architectural Room Grid Floor if in simulated mode */}
            {feedMode === 'simulated' && (
              <div className="absolute inset-0 bg-[radial-gradient(#262626_1px,transparent_1px)] [background-size:24px_24px] opacity-35" />
            )}

            {/* Render Configured Zones Overlay */}
            {showZones &&
              zones.map((zone) => (
                <div
                  key={zone.id}
                  style={{
                    left: `${zone.x * 100}%`,
                    top: `${zone.y * 100}%`,
                    width: `${zone.width * 100}%`,
                    height: `${zone.height * 100}%`,
                    borderColor: zone.color,
                    backgroundColor: `${zone.color}15`,
                  }}
                  className="absolute border-2 border-dashed rounded-lg transition-all flex flex-col justify-between p-2 pointer-events-none"
                >
                  <span
                    style={{ color: zone.color }}
                    className="text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 bg-neutral-950/80 rounded w-fit border border-neutral-800"
                  >
                    {zone.name}
                  </span>
                  <span className="text-[10px] text-neutral-400 self-end">
                    ({zone.type})
                  </span>
                </div>
              ))}

            {/* Render Person Bounding Box & Target HUD */}
            {status?.isOccupied && personBbox && feedMode !== 'pi_mjpeg' && (
              <div
                style={{
                  left: `${personBbox.x * 100}%`,
                  top: `${personBbox.y * 100}%`,
                  width: `${personBbox.width * 100}%`,
                  height: `${personBbox.height * 100}%`,
                }}
                className={`absolute transition-all duration-200 rounded pointer-events-none ${
                  currentActivity === 'POSSIBLE_FALL'
                    ? 'border-2 border-rose-500 bg-rose-500/20'
                    : 'border-2 border-emerald-400 bg-emerald-500/10'
                }`}
              >
                {/* HUD Header Label */}
                <div className="absolute -top-7 left-0 px-2 py-0.5 bg-neutral-900 border border-neutral-700 text-neutral-100 rounded text-xs font-mono flex items-center gap-1.5 whitespace-nowrap shadow-lg">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      currentActivity === 'POSSIBLE_FALL' ? 'bg-rose-500 animate-ping' : 'bg-emerald-400'
                    }`}
                  />
                  <span className="font-semibold">{status.currentPersonId || 'person_001'}</span>
                  <span className="text-neutral-400">[{currentActivity}]</span>
                </div>

                {/* Silhouette or Centroid Graphic */}
                {privacyStyle === 'silhouette' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-20 rounded-full border border-emerald-400/40 bg-emerald-400/10 flex flex-col items-center justify-center">
                      <div className="w-5 h-5 rounded-full bg-emerald-400/60 mb-1" />
                      <div className="w-8 h-10 rounded-full bg-emerald-400/40" />
                    </div>
                  </div>
                )}

                {/* Center Point Dot */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="w-3 h-3 rounded-full bg-white border border-neutral-900 shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[10px] text-neutral-300 font-mono whitespace-nowrap">
                    {currentZone?.name || 'Open Area'}
                  </div>
                </div>
              </div>
            )}

            {/* Vacant State Banner if room empty */}
            {!status?.isOccupied && feedMode !== 'pi_mjpeg' && (
              <div className="text-center p-6 bg-neutral-900/80 border border-neutral-800 rounded-xl max-w-sm">
                <Eye className="w-8 h-8 text-neutral-500 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-neutral-200">Room is Currently Vacant</h4>
                <p className="text-xs text-neutral-400 mt-1">
                  No person is present in the monitored area. Spatial events will trigger when motion is detected.
                </p>
              </div>
            )}
          </div>

          {/* Bottom Telemetry Bar */}
          <div className="p-4 border-t border-neutral-800 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-neutral-400 block text-[11px]">Normalized Coordinates</span>
              <span className="font-mono tabular-nums text-neutral-200">
                X: {status?.position?.x.toFixed(3) || '0.000'} · Y: {status?.position?.y.toFixed(3) || '0.000'}
              </span>
            </div>
            <div>
              <span className="text-neutral-400 block text-[11px]">Velocity</span>
              <span className="font-mono tabular-nums text-neutral-200">
                {((status?.velocity || 0) * 10).toFixed(2)} units/sec
              </span>
            </div>
            <div>
              <span className="text-neutral-400 block text-[11px]">Posture Duration</span>
              <span className="font-mono tabular-nums text-emerald-400 font-medium">
                {formatDuration(status?.activityDurationSeconds || 0)}
              </span>
            </div>
            <div>
              <span className="text-neutral-400 block text-[11px]">Stationary Inactivity</span>
              <span className="font-mono tabular-nums text-neutral-200">
                {formatDuration(status?.inactivitySeconds || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Live Status Cards (1 col) */}
        <div className="space-y-4">
          {/* Posture Card */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
            <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider block mb-2">
              Current Posture
            </span>
            <div className="text-2xl font-bold text-neutral-100 mb-1 flex items-center gap-2">
              <span
                className={`w-3 h-3 rounded-full ${
                  currentActivity === 'POSSIBLE_FALL'
                    ? 'bg-rose-500 animate-ping'
                    : currentActivity === 'SITTING'
                    ? 'bg-emerald-400'
                    : currentActivity === 'STANDING'
                    ? 'bg-sky-400'
                    : 'bg-purple-400'
                }`}
              />
              <span>{currentActivity}</span>
            </div>
            <p className="text-xs text-neutral-400">
              Active in zone: <strong className="text-neutral-200">{currentZone?.name || 'Open Area'}</strong>
            </p>
          </div>

          {/* Session Duration */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
            <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider block mb-2">
              Occupancy Session
            </span>
            <div className="text-2xl font-bold font-mono tabular-nums text-neutral-100 mb-1">
              {formatDuration(status?.sessionDurationSeconds || 0)}
            </div>
            <p className="text-xs text-neutral-400">Continuous presence since entry</p>
          </div>

          {/* USB Camera Quick Test card */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                USB Hardware Test
              </span>
              <Camera className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Plug any UVC USB webcam into the Raspberry Pi. The OpenCV pipeline auto-initializes on index 0.
            </p>
            <button
              onClick={() => setShowPiSetupHelp(true)}
              className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors"
            >
              View Pi Camera Commands
            </button>
          </div>

          {/* Fall Incident Testing Card */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                Fall Detection Test
              </span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Inject a simulated rapid downward aspect ratio collapse to verify real-time alert dispatching.
            </p>
            <button
              onClick={onSimulateFall}
              disabled={isSimulating}
              className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-colors"
            >
              {isSimulating ? 'Processing Test...' : 'Simulate Potential Fall'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

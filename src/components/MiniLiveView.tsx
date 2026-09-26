import React, { useState, useEffect, useRef } from 'react';
import {
  Eye,
  EyeOff,
  X,
  Minimize2,
  Maximize2,
  Radio,
  Camera,
  Layers,
  Activity,
  AlertTriangle,
  Move,
  RefreshCw,
} from 'lucide-react';
import { RoomStatus, Zone } from '../types/index.ts';

interface MiniLiveViewProps {
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  status: RoomStatus | null;
  zones: Zone[];
  piStreamUrl?: string;
}

export const MiniLiveView: React.FC<MiniLiveViewProps> = ({
  isOpen,
  onToggle,
  status,
  zones,
  piStreamUrl = '/api/camera/stream',
}) => {
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [feedSource, setFeedSource] = useState<'pi_stream' | 'abstract' | 'webcam'>('pi_stream');
  const [resolution, setResolution] = useState<'low' | 'micro'>('low'); // 'low' = 240p, 'micro' = 120p
  const [streamError, setStreamError] = useState<boolean>(false);
  const [localWebcamActive, setLocalWebcamActive] = useState<boolean>(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: 0,
    posY: 0,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Fallback to abstract if stream fails repeatedly
  useEffect(() => {
    setStreamError(false);
  }, [piStreamUrl]);

  // Handle local webcam if selected
  useEffect(() => {
    if (feedSource === 'webcam') {
      let currentStream: MediaStream | null = null;
      navigator.mediaDevices
        ?.getUserMedia({ video: { width: 240, height: 160 } })
        .then((stream) => {
          currentStream = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
            setLocalWebcamActive(true);
          }
        })
        .catch(() => {
          setFeedSource('abstract');
          setLocalWebcamActive(false);
        });

      return () => {
        if (currentStream) {
          currentStream.getTracks().forEach((track) => track.stop());
        }
        setLocalWebcamActive(false);
      };
    }
  }, [feedSource]);

  // Abstract radar canvas animation when in abstract or fallback mode
  useEffect(() => {
    if (feedSource !== 'abstract' && !streamError) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let pulse = 0;

    const render = () => {
      pulse += 0.05;
      const w = canvas.width;
      const h = canvas.height;

      // Dark background with scan grid
      ctx.fillStyle = '#090a0f';
      ctx.fillRect(0, 0, w, h);

      // Grid lines
      ctx.strokeStyle = '#1e2433';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Draw zones
      zones.forEach((z, idx) => {
        const colors = ['rgba(16, 185, 129, 0.15)', 'rgba(14, 165, 233, 0.15)', 'rgba(245, 158, 11, 0.15)'];
        const borderColors = ['#10b981', '#0ea5e9', '#f59e0b'];
        const zx = z.polygon[0]?.x * w || 10 + idx * 40;
        const zy = z.polygon[0]?.y * h || 10;
        const zw = 50;
        const zh = 40;

        ctx.fillStyle = colors[idx % colors.length];
        ctx.strokeStyle = borderColors[idx % borderColors.length];
        ctx.strokeRect(zx, zy, zw, zh);
        ctx.fillRect(zx, zy, zw, zh);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '8px sans-serif';
        ctx.fillText(z.name.substring(0, 8), zx + 2, zy + 10);
      });

      // Draw Person Centroid
      const px = (status?.position?.x ?? 0.5) * w;
      const py = (status?.position?.y ?? 0.5) * h;
      const act = status?.currentActivity || 'STANDING';

      let dotColor = '#10b981';
      if (act === 'POSSIBLE_FALL') dotColor = '#ef4444';
      else if (act === 'SITTING') dotColor = '#0ea5e9';
      else if (act === 'WALKING') dotColor = '#a855f7';

      // Pulse ring
      ctx.strokeStyle = dotColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, 8 + Math.sin(pulse) * 3, 0, Math.PI * 2);
      ctx.stroke();

      // Core point
      ctx.fillStyle = dotColor;
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();

      // Bounding wireframe
      if (status?.bbox) {
        const bw = status.bbox.width * w;
        const bh = status.bbox.height * h;
        ctx.strokeStyle = dotColor;
        ctx.setLineDash([2, 2]);
        ctx.strokeRect(px - bw / 2, py - bh / 2, bw, bh);
        ctx.setLineDash([]);
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [feedSource, streamError, status, zones]);

  // Dragging logic
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position?.x ?? 0,
      posY: position?.y ?? 0,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPosition({
        x: dragRef.current.posX + dx,
        y: dragRef.current.posY + dy,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  if (!isOpen) return null;

  const currentActivity = status?.currentActivity || 'STANDING';
  const isFall = currentActivity === 'POSSIBLE_FALL';

  // Dimensions based on low vs micro resolution
  const viewWidth = resolution === 'micro' ? 180 : 260;
  const viewHeight = resolution === 'micro' ? 120 : 175;

  return (
    <div
      style={{
        transform: position ? `translate(${position.x}px, ${position.y}px)` : undefined,
        width: viewWidth,
      }}
      className={`fixed bottom-6 right-6 z-50 rounded-xl bg-neutral-900/95 border border-neutral-700/80 shadow-2xl backdrop-blur-md overflow-hidden transition-all duration-150 ${
        isFall ? 'ring-2 ring-rose-500 animate-pulse' : ''
      }`}
    >
      {/* Header bar (Draggable) */}
      <div
        onMouseDown={handleMouseDown}
        className="flex items-center justify-between px-2.5 py-1.5 bg-neutral-950/80 border-b border-neutral-800 cursor-move select-none"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isFall ? 'bg-rose-400' : 'bg-emerald-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isFall ? 'bg-rose-500' : 'bg-emerald-500'
              }`}
            />
          </span>
          <span className="text-[11px] font-semibold text-neutral-200 truncate">
            Low-Res Live View
          </span>
          <span className="text-[9px] px-1 py-0.2 rounded bg-neutral-800 text-neutral-400 font-mono">
            {resolution === 'micro' ? '120p' : '240p'}
          </span>
        </div>

        {/* Window controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setResolution(resolution === 'low' ? 'micro' : 'low')}
            title={`Switch to ${resolution === 'low' ? 'Micro 120p' : 'Low-Res 240p'}`}
            className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors text-[9px] font-mono"
          >
            {resolution === 'low' ? '120p' : '240p'}
          </button>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? 'Expand view' : 'Minimize view'}
            className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            {isMinimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
          </button>
          <button
            onClick={() => onToggle(false)}
            title="Turn Off Mini Live View"
            className="p-1 rounded text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Main View Area (Hidden when minimized) */}
      {!isMinimized && (
        <>
          <div
            style={{ width: viewWidth, height: viewHeight }}
            className="relative bg-black flex items-center justify-center overflow-hidden"
          >
            {/* Stream View */}
            {feedSource === 'pi_stream' && !streamError && (
              <img
                src={piStreamUrl}
                alt="Low-Res Edge Stream"
                className="w-full h-full object-cover filter contrast-105"
                onError={() => setStreamError(true)}
              />
            )}

            {/* Local Browser Webcam View */}
            {feedSource === 'webcam' && (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            )}

            {/* Abstract Radar / Fallback View */}
            {(feedSource === 'abstract' || streamError) && (
              <canvas
                ref={canvasRef}
                width={viewWidth}
                height={viewHeight}
                className="w-full h-full block"
              />
            )}

            {/* Low-res Scanlines / Pixelated CRT overlay for privacy visual effect */}
            <div
              className="absolute inset-0 pointer-events-none opacity-20"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 0, 0, 0.7) 2px, rgba(0, 0, 0, 0.7) 4px)',
              }}
            />

            {/* Live HUD Badges overlaid on top of feed */}
            <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded shadow ${
                  isFall
                    ? 'bg-rose-600 text-white'
                    : currentActivity === 'SITTING'
                    ? 'bg-sky-600/90 text-white'
                    : currentActivity === 'WALKING'
                    ? 'bg-purple-600/90 text-white'
                    : 'bg-emerald-600/90 text-white'
                }`}
              >
                {currentActivity}
              </span>
            </div>

            <div className="absolute top-1.5 right-1.5 text-[9px] font-mono text-neutral-300 bg-black/60 px-1 py-0.5 rounded backdrop-blur-xs">
              {status?.isOccupied ? 'OCCUPIED' : 'VACANT'}
            </div>

            {/* Bottom HUD: Position & Zone */}
            <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between text-[8px] font-mono text-neutral-300 bg-neutral-950/75 px-1.5 py-0.5 rounded backdrop-blur-xs">
              <span className="truncate max-w-[130px]">
                {status?.currentZone?.name || 'Open Area'}
              </span>
              <span>
                {status?.position
                  ? `(${status.position.x.toFixed(2)}, ${status.position.y.toFixed(2)})`
                  : 'N/A'}
              </span>
            </div>

            {/* Stream reconnect prompt if error */}
            {streamError && feedSource === 'pi_stream' && (
              <div className="absolute inset-0 bg-neutral-950/90 flex flex-col items-center justify-center p-2 text-center">
                <AlertTriangle className="w-5 h-5 text-amber-400 mb-1" />
                <span className="text-[10px] text-neutral-300 font-medium">Edge stream unavailable</span>
                <span className="text-[8px] text-neutral-500 mb-1.5">Check /dev/video0 on Pi</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setStreamError(false)}
                    className="text-[9px] bg-neutral-800 hover:bg-neutral-700 px-2 py-0.5 rounded text-neutral-200"
                  >
                    Retry
                  </button>
                  <button
                    onClick={() => setFeedSource('abstract')}
                    className="text-[9px] bg-emerald-800/60 hover:bg-emerald-700/60 px-2 py-0.5 rounded text-emerald-200"
                  >
                    Use Radar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer controls: Source Selector */}
          <div className="px-2 py-1.5 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-1 text-neutral-400">
              <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
              <span>Source:</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setFeedSource('pi_stream');
                  setStreamError(false);
                }}
                className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors ${
                  feedSource === 'pi_stream'
                    ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Pi Cam
              </button>
              <button
                onClick={() => setFeedSource('abstract')}
                className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors ${
                  feedSource === 'abstract'
                    ? 'bg-sky-600/30 text-sky-300 border border-sky-500/40'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Radar HUD
              </button>
              <button
                onClick={() => setFeedSource('webcam')}
                className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors ${
                  feedSource === 'webcam'
                    ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Browser
              </button>
            </div>
          </div>
        </>
      )}

      {/* Minimized status chip */}
      {isMinimized && (
        <div className="px-3 py-2 flex items-center justify-between text-[11px] bg-neutral-950">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isFall ? 'bg-rose-500 animate-ping' : 'bg-emerald-400'
              }`}
            />
            <span className="font-semibold text-neutral-200">{currentActivity}</span>
          </div>
          <span className="text-[10px] text-neutral-400 font-mono">
            {status?.currentZone?.name || 'Room Area'}
          </span>
        </div>
      )}
    </div>
  );
};

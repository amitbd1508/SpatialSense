import React, { useRef, useEffect, useState } from 'react';
import { Flame, RefreshCw, Layers, Sliders, Eye } from 'lucide-react';
import { Zone, SpatialPoint, ActivityType } from '../types/index.ts';
import { api } from '../api.ts';

interface HeatmapViewProps {
  zones: Zone[];
}

export const HeatmapView: React.FC<HeatmapViewProps> = ({ zones }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [points, setPoints] = useState<SpatialPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterActivity, setFilterActivity] = useState<string>('ALL');
  const [intensityRadius, setIntensityRadius] = useState<number>(24);
  const [showZones, setShowZones] = useState<boolean>(true);

  const fetchHeatmapData = async () => {
    try {
      setLoading(true);
      const data = await api.getHeatmap(2000);
      setPoints(data.points || []);
    } catch (err) {
      console.error('Failed to load heatmap data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHeatmapData();
  }, []);

  // Render Heatmap on HTML5 Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // 1. Dark architectural background
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 0, width, height);

    // 2. Subtle architectural grid pattern
    ctx.strokeStyle = '#1e2638';
    ctx.lineWidth = 1;
    const gridSize = 32;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 3. Render Heatmap accumulation layer
    // Create an offscreen alpha intensity buffer
    const alphaCanvas = document.createElement('canvas');
    alphaCanvas.width = width;
    alphaCanvas.height = height;
    const alphaCtx = alphaCanvas.getContext('2d');

    if (alphaCtx) {
      // Filter points
      const filtered = points.filter((pt) => {
        if (filterActivity === 'ALL') return true;
        return pt.activity === filterActivity;
      });

      // Draw radial alpha spots for each coordinate
      filtered.forEach((pt) => {
        const px = pt.x * width;
        const py = pt.y * height;
        const rad = intensityRadius;

        const radGrad = alphaCtx.createRadialGradient(px, py, 1, px, py, rad);
        radGrad.addColorStop(0, 'rgba(0,0,0,0.18)');
        radGrad.addColorStop(1, 'rgba(0,0,0,0)');

        alphaCtx.fillStyle = radGrad;
        alphaCtx.beginPath();
        alphaCtx.arc(px, py, rad, 0, Math.PI * 2);
        alphaCtx.fill();
      });

      // Colorize alpha intensity buffer using a thermal palette
      const imgData = alphaCtx.getImageData(0, 0, width, height);
      const pixels = imgData.data;

      // Color ramp from dark slate -> emerald -> amber -> warm crimson
      for (let i = 0; i < pixels.length; i += 4) {
        const alpha = pixels[i + 3];
        if (alpha > 0) {
          const norm = alpha / 255;
          let r = 0, g = 0, b = 0;

          if (norm < 0.25) {
            // Dark Teal / Sky
            r = 14; g = 116 + Math.floor(norm * 4 * 100); b = 144;
          } else if (norm < 0.55) {
            // Emerald to Lime
            r = 16 + Math.floor((norm - 0.25) * 3.33 * 180);
            g = 185;
            b = 129 - Math.floor((norm - 0.25) * 3.33 * 80);
          } else if (norm < 0.8) {
            // Amber / Orange
            r = 245;
            g = 158 - Math.floor((norm - 0.55) * 4 * 60);
            b = 11;
          } else {
            // High Heat Crimson
            r = 239;
            g = 68;
            b = 68;
          }

          pixels[i] = r;
          pixels[i + 1] = g;
          pixels[i + 2] = b;
          pixels[i + 3] = Math.min(230, alpha * 2.2);
        }
      }

      ctx.putImageData(imgData, 0, 0);
    }

    // 4. Draw Room Zones Overlay on top
    if (showZones) {
      zones.forEach((z) => {
        const zx = z.x * width;
        const zy = z.y * height;
        const zw = z.width * width;
        const zh = z.height * height;

        ctx.strokeStyle = z.color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(zx, zy, zw, zh);
        ctx.setLineDash([]);

        // Zone label badge
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(zx + 4, zy + 4, ctx.measureText(z.name).width + 12, 18);
        ctx.strokeStyle = z.color;
        ctx.lineWidth = 1;
        ctx.strokeRect(zx + 4, zy + 4, ctx.measureText(z.name).width + 12, 18);

        ctx.fillStyle = z.color;
        ctx.font = 'bold 10px Plus Jakarta Sans, sans-serif';
        ctx.fillText(z.name.toUpperCase(), zx + 10, zy + 16);
      });
    }
  }, [points, filterActivity, intensityRadius, showZones, zones]);

  return (
    <div className="space-y-6">
      {/* Heatmap Control Toolbar */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-400">Activity Filter:</span>
          <div className="flex items-center p-1 bg-neutral-950 rounded-lg border border-neutral-800">
            {['ALL', 'SITTING', 'STANDING', 'WALKING'].map((act) => (
              <button
                key={act}
                onClick={() => setFilterActivity(act)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  filterActivity === act
                    ? 'bg-neutral-800 text-white'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {act === 'ALL' ? 'All Activities' : act}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Intensity Slider */}
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <Sliders className="w-3.5 h-3.5" />
            <span>Density Radius:</span>
            <input
              type="range"
              min="12"
              max="48"
              value={intensityRadius}
              onChange={(e) => setIntensityRadius(Number(e.target.value))}
              className="w-24 accent-emerald-500 cursor-pointer"
            />
            <span className="font-mono text-neutral-200 w-6">{intensityRadius}</span>
          </div>

          {/* Zone toggle */}
          <button
            onClick={() => setShowZones(!showZones)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              showZones
                ? 'bg-neutral-800 border-neutral-700 text-neutral-200'
                : 'border-neutral-800 text-neutral-400'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Show Zones</span>
          </button>

          <button
            onClick={fetchHeatmapData}
            disabled={loading}
            className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg transition-colors"
            title="Refresh coordinates"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2D Canvas Heatmap Box */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-neutral-100">
              Spatial Density Representation
            </h3>
            <p className="text-xs text-neutral-400">
              Accumulated coordinates without storing any video frames ({points.length} points plotted)
            </p>
          </div>

          {/* Thermal Legend */}
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <span>Low Usage</span>
            <div className="w-32 h-2.5 rounded-full bg-linear-to-r from-sky-700 via-emerald-500 via-amber-400 to-rose-600" />
            <span>High Dwell Time</span>
          </div>
        </div>

        <div className="relative aspect-16/10 w-full bg-neutral-950 rounded-lg border border-neutral-800 overflow-hidden flex items-center justify-center">
          <canvas
            ref={canvasRef}
            width={960}
            height={600}
            className="w-full h-full object-contain"
          />
        </div>

        <div className="mt-4 pt-4 border-t border-neutral-800 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-neutral-400">
          <div>
            <span className="block font-medium text-neutral-300">Privacy Safeguard</span>
            <span>Zero pixel data is retained; points are purely normalized (x, y) vectors.</span>
          </div>
          <div>
            <span className="block font-medium text-neutral-300">Primary Dwell Hotspot</span>
            <span className="text-emerald-400 font-medium">Work Desk & Chair (68% dwell density)</span>
          </div>
          <div>
            <span className="block font-medium text-neutral-300">Secondary Utilization</span>
            <span>Rest Lounge & transition path between entry door and work station.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

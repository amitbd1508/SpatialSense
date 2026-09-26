import React, { useState, useRef } from 'react';
import { Layers, Plus, Trash2, Edit2, Check, X, MousePointer } from 'lucide-react';
import { Zone, ZoneType } from '../types/index.ts';
import { ZONE_PRESET_COLORS } from '../utils.ts';
import { api } from '../api.ts';

interface ZonesViewProps {
  zones: Zone[];
  onZonesChanged: () => void;
}

export const ZonesView: React.FC<ZonesViewProps> = ({ zones, onZonesChanged }) => {
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [currentBox, setCurrentBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const [newZoneName, setNewZoneName] = useState<string>('');
  const [newZoneType, setNewZoneType] = useState<ZoneType>('desk');
  const [newZoneColor, setNewZoneColor] = useState<string>('#10b981');
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Mouse handlers for drawing zone on canvas
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    setDragStart({ x, y });
    setCurrentBox({ x, y, width: 0, height: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragStart || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const curX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const curY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const left = Math.min(dragStart.x, curX);
    const top = Math.min(dragStart.y, curY);
    const width = Math.abs(curX - dragStart.x);
    const height = Math.abs(curY - dragStart.y);

    setCurrentBox({ x: left, y: top, width, height });
  };

  const handleMouseUp = () => {
    setDragStart(null);
  };

  const handleSaveZone = async () => {
    if (!currentBox || currentBox.width < 0.04 || currentBox.height < 0.04) {
      alert('Please drag a rectangular box on the room frame to define the zone.');
      return;
    }
    if (!newZoneName.trim()) {
      alert('Please enter a descriptive zone name.');
      return;
    }

    try {
      setSaveLoading(true);
      await api.createZone({
        name: newZoneName.trim(),
        type: newZoneType,
        color: newZoneColor,
        x: currentBox.x,
        y: currentBox.y,
        width: currentBox.width,
        height: currentBox.height,
      });
      setCurrentBox(null);
      setIsDrawing(false);
      setNewZoneName('');
      onZonesChanged();
    } catch (err) {
      console.error('Failed to create zone:', err);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDeleteZone = async (id: string) => {
    try {
      await api.deleteZone(id);
      onZonesChanged();
    } catch (err) {
      console.error('Failed to delete zone:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Toolbar */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-neutral-100">Room Zone Calibration</h3>
          <p className="text-xs text-neutral-400">
            Define bounding regions to classify person location (Desk, Bed, Chair, Door).
          </p>
        </div>

        <button
          onClick={() => {
            setIsDrawing(!isDrawing);
            setCurrentBox(null);
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            isDrawing
              ? 'bg-amber-600 text-white'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
          }`}
        >
          {isDrawing ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          <span>{isDrawing ? 'Cancel Drawing' : '+ Draw New Zone'}</span>
        </button>
      </div>

      {/* Interactive Calibration Canvas Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: 2D Interactive Room Drag-and-Drop Area (2 cols) */}
        <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-3 text-xs text-neutral-400">
            <span>
              {isDrawing
                ? 'Click & drag across the floorplan to outline the zone rectangle'
                : 'Interactive Zone Map'}
            </span>
            <span className="font-mono">{zones.length} Active Zones</span>
          </div>

          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className={`relative aspect-16/10 w-full bg-neutral-950 rounded-lg border border-neutral-800 overflow-hidden select-none ${
              isDrawing ? 'cursor-crosshair' : 'cursor-default'
            }`}
          >
            {/* Grid Floor */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#262626_1px,transparent_1px),linear-gradient(to_bottom,#262626_1px,transparent_1px)] bg-[size:24px_24px] opacity-25" />

            {/* Existing Zones */}
            {zones.map((zone) => (
              <div
                key={zone.id}
                style={{
                  left: `${zone.x * 100}%`,
                  top: `${zone.y * 100}%`,
                  width: `${zone.width * 100}%`,
                  height: `${zone.height * 100}%`,
                  borderColor: zone.color,
                  backgroundColor: `${zone.color}20`,
                }}
                className="absolute border-2 border-dashed rounded-lg p-2 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span
                    style={{ color: zone.color }}
                    className="text-xs font-semibold px-2 py-0.5 bg-neutral-900/90 rounded border border-neutral-700 w-fit"
                  >
                    {zone.name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteZone(zone.id);
                    }}
                    className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-rose-400 rounded transition-colors"
                    title="Delete Zone"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-[10px] text-neutral-400 self-end font-mono">
                  {zone.type}
                </div>
              </div>
            ))}

            {/* Box currently being drawn */}
            {currentBox && (
              <div
                style={{
                  left: `${currentBox.x * 100}%`,
                  top: `${currentBox.y * 100}%`,
                  width: `${currentBox.width * 100}%`,
                  height: `${currentBox.height * 100}%`,
                  borderColor: newZoneColor,
                  backgroundColor: `${newZoneColor}30`,
                }}
                className="absolute border-2 border-dashed rounded pointer-events-none"
              >
                <span
                  style={{ color: newZoneColor }}
                  className="absolute top-2 left-2 text-xs font-mono font-bold bg-neutral-900 px-1.5 py-0.5 rounded"
                >
                  {newZoneName || 'New Zone'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Zone Config & Details Form */}
        <div className="space-y-4">
          {isDrawing ? (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
              <h4 className="text-sm font-semibold text-neutral-100">Zone Configuration</h4>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Zone Name</label>
                <input
                  type="text"
                  placeholder="e.g. Standing Desk, Executive Chair"
                  value={newZoneName}
                  onChange={(e) => setNewZoneName(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Zone Type</label>
                <select
                  value={newZoneType}
                  onChange={(e) => {
                    const t = e.target.value as ZoneType;
                    setNewZoneType(t);
                    setNewZoneColor(ZONE_PRESET_COLORS[t] || '#10b981');
                  }}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none"
                >
                  <option value="desk">Desk (Work Station)</option>
                  <option value="chair">Chair (Ergonomic Seating)</option>
                  <option value="bed">Bed / Rest Couch</option>
                  <option value="door">Door (Entry / Exit)</option>
                  <option value="kitchen">Kitchen / Refreshment</option>
                  <option value="bathroom">Bathroom</option>
                  <option value="living">Living Area</option>
                  <option value="custom">Custom Area</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Color Palette</label>
                <div className="flex items-center gap-2">
                  {Object.values(ZONE_PRESET_COLORS).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewZoneColor(c)}
                      style={{ backgroundColor: c }}
                      className={`w-6 h-6 rounded-full transition-transform ${
                        newZoneColor === c ? 'scale-125 ring-2 ring-white' : 'opacity-80'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleSaveZone}
                  disabled={saveLoading}
                  className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{saveLoading ? 'Saving Zone...' : 'Save Zone into DB'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-3">
              <h4 className="text-sm font-semibold text-neutral-100">Zone List</h4>
              <p className="text-xs text-neutral-400">
                Zones are calibrated in normalized coordinates (0.0 to 1.0).
              </p>

              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {zones.map((z) => (
                  <div
                    key={z.id}
                    className="p-3 bg-neutral-950/60 rounded-lg border border-neutral-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        style={{ backgroundColor: z.color }}
                        className="w-2.5 h-2.5 rounded-full"
                      />
                      <div>
                        <div className="font-semibold text-neutral-200">{z.name}</div>
                        <div className="text-[10px] text-neutral-400 uppercase tracking-wider">
                          {z.type}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteZone(z.id)}
                      className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-rose-400 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

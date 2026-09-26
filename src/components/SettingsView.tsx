import React, { useState } from 'react';
import {
  Settings,
  Shield,
  Radio,
  Sliders,
  Check,
  Cpu,
  Terminal,
  Save,
} from 'lucide-react';
import { RoomSettings } from '../types/index.ts';
import { api } from '../api.ts';

interface SettingsViewProps {
  settings: RoomSettings | null;
  onSettingsSaved: (updated: RoomSettings) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSettingsSaved,
}) => {
  const [formData, setFormData] = useState<Partial<RoomSettings>>(settings || {});
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const updated = await api.updateSettings(formData);
      onSettingsSaved(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <form onSubmit={handleSave} className="space-y-6">
        {/* General Room & Detection Settings */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-neutral-100">Room & Detection Parameters</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-neutral-400 block mb-1">Room / Workspace Label</label>
              <input
                type="text"
                value={formData.roomName || ''}
                onChange={(e) => setFormData({ ...formData, roomName: e.target.value })}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs text-neutral-400 block mb-1">
                Prolonged Inactivity Alert Threshold (Minutes)
              </label>
              <input
                type="number"
                min="5"
                max="120"
                value={formData.inactivityThresholdMinutes || 30}
                onChange={(e) =>
                  setFormData({ ...formData, inactivityThresholdMinutes: Number(e.target.value) })
                }
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 font-mono focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-neutral-400 block mb-1">
                Edge Camera / Video Capture FPS
              </label>
              <select
                value={formData.fps || 10}
                onChange={(e) => setFormData({ ...formData, fps: Number(e.target.value) })}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none"
              >
                <option value={5}>5 FPS (Minimal CPU usage ~15%)</option>
                <option value={10}>10 FPS (Recommended balance ~25%)</option>
                <option value={15}>15 FPS (High fluid tracking ~40%)</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-neutral-400 block mb-1">
                Detection Confidence Threshold ({Math.round((formData.detectionConfidence || 0.65) * 100)}%)
              </label>
              <input
                type="range"
                min="0.4"
                max="0.95"
                step="0.05"
                value={formData.detectionConfidence || 0.65}
                onChange={(e) =>
                  setFormData({ ...formData, detectionConfidence: Number(e.target.value) })
                }
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Abstract Sensor Architecture */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
            <Radio className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-semibold text-neutral-100">Abstract Sensor Source</h3>
          </div>
          <p className="text-xs text-neutral-400">
            The spatial intelligence pipeline consumes standardized observations, enabling hot-swapping between optical cameras and mmWave radar point clouds.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                id: 'simulation',
                title: 'Demo Simulator',
                desc: 'Generates realistic human presence & transitions without hardware.',
              },
              {
                id: 'camera',
                title: 'Optical Edge Camera',
                desc: 'Local Raspberry Pi / USB webcam with on-device computer vision.',
              },
              {
                id: 'mmwave',
                title: 'mmWave Radar (V2)',
                desc: '24GHz/60GHz Doppler point clouds (zero optical lenses).',
              },
            ].map((sensor) => (
              <div
                key={sensor.id}
                onClick={() => setFormData({ ...formData, activeSensor: sensor.id as any })}
                className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                  formData.activeSensor === sensor.id
                    ? 'bg-neutral-800/80 border-emerald-500 text-neutral-100'
                    : 'bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <div className="text-xs font-semibold mb-1 text-neutral-200">{sensor.title}</div>
                <div className="text-[11px] leading-relaxed">{sensor.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Privacy Safeguards */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
            <Shield className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-neutral-100">Privacy-First Policies</h3>
          </div>

          <div className="space-y-3 text-xs text-neutral-400">
            <div className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
              <span>
                <strong>No Raw Video Retention:</strong> Video frames are analyzed in transient RAM and discarded immediately.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
              <span>
                <strong>Zero Facial Recognition:</strong> Biometrics, faces, emotions, and personal identities are strictly excluded from the model pipeline.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
              <span>
                <strong>Anonymous Session IDs:</strong> Ephemeral labels (e.g. <code>person_001</code>) exist only for the duration of room occupancy.
              </span>
            </div>
          </div>
        </div>

        {/* Raspberry Pi Boot Service Instructions */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-neutral-100">Raspberry Pi Auto-Start (systemd)</h3>
          </div>
          <p className="text-xs text-neutral-400">
            To ensure the edge engine automatically boots when your Raspberry Pi powers on, run:
          </p>
          <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800 font-mono text-[11px] text-emerald-400 select-all overflow-x-auto">
            sudo cp scripts/spatialsense.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable spatialsense && sudo systemctl start spatialsense
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-end gap-3">
          {saveSuccess && (
            <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
              <Check className="w-3.5 h-3.5" />
              Settings updated successfully
            </span>
          )}
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

import React, { useState } from 'react';
import {
  X,
  Camera,
  Check,
  ArrowRight,
  ArrowLeft,
  Sliders,
  ShieldCheck,
  Layers,
  Radio,
} from 'lucide-react';
import { Zone, RoomSettings } from '../types/index.ts';
import { api } from '../api.ts';

interface SetupWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  zones: Zone[];
  settings: RoomSettings | null;
}

export const SetupWizardModal: React.FC<SetupWizardModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  zones,
  settings,
}) => {
  const [step, setStep] = useState<number>(1);
  const [roomName, setRoomName] = useState<string>(settings?.roomName || 'Master Studio');
  const [inactivityMinutes, setInactivityMinutes] = useState<number>(
    settings?.inactivityThresholdMinutes || 30
  );
  const [selectedSensor, setSelectedSensor] = useState<'camera' | 'simulation'>('simulation');

  if (!isOpen) return null;

  const handleFinish = async () => {
    try {
      await api.updateSettings({
        roomName,
        inactivityThresholdMinutes: inactivityMinutes,
        activeSensor: selectedSensor,
        demoMode: selectedSensor === 'simulation',
      });
      onComplete();
      onClose();
    } catch (err) {
      console.error('Failed to complete wizard:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-neutral-100">
              SpatialSense Room Setup Wizard
            </h3>
            <p className="text-xs text-neutral-400">Step {step} of 6</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="h-1 bg-neutral-800 w-full">
          <div
            style={{ width: `${(step / 6) * 100}%` }}
            className="h-full bg-emerald-500 transition-all duration-300"
          />
        </div>

        {/* Content Body */}
        <div className="p-6 flex-1 min-h-[300px] flex flex-col justify-center">
          {/* Step 1: Connect Camera */}
          {step === 1 && (
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <Camera className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-neutral-100">Step 1: Sensor Hardware Source</h4>
                <p className="text-xs text-neutral-400 mt-1 max-w-md mx-auto">
                  Select whether you are pairing with a local webcam or running the simulated edge node.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 max-w-md mx-auto text-left pt-2">
                <div
                  onClick={() => setSelectedSensor('camera')}
                  className={`p-3 rounded-xl border cursor-pointer text-xs transition-colors ${
                    selectedSensor === 'camera'
                      ? 'bg-neutral-800 border-emerald-500 text-white'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                  }`}
                >
                  <div className="font-semibold text-neutral-200">Local Camera / Webcam</div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">Edge CV on local device</div>
                </div>

                <div
                  onClick={() => setSelectedSensor('simulation')}
                  className={`p-3 rounded-xl border cursor-pointer text-xs transition-colors ${
                    selectedSensor === 'simulation'
                      ? 'bg-neutral-800 border-emerald-500 text-white'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                  }`}
                >
                  <div className="font-semibold text-neutral-200">Demo Simulator Node</div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">Software simulated room</div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Preview Camera */}
          {step === 2 && (
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mx-auto">
                <Radio className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-neutral-100">Step 2: Stream Calibration</h4>
                <p className="text-xs text-neutral-400 mt-1">
                  Ensure the room coverage encompasses key entry points and desk/seating areas.
                </p>
              </div>
              <div className="aspect-16/9 max-w-sm mx-auto bg-neutral-950 rounded-lg border border-neutral-800 flex items-center justify-center text-xs text-neutral-400">
                <span>Viewport Calibrated (640x480 @ 10 FPS)</span>
              </div>
            </div>
          )}

          {/* Step 3: Name Room */}
          {step === 3 && (
            <div className="space-y-4 max-w-md mx-auto w-full">
              <h4 className="text-sm font-semibold text-neutral-100 text-center">Step 3: Name Your Monitored Room</h4>
              <p className="text-xs text-neutral-400 text-center">
                Give your indoor space a recognizable name for timeline reporting.
              </p>
              <div>
                <label className="text-xs text-neutral-400 block mb-1">Room Name</label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          {/* Step 4: Draw Zones */}
          {step === 4 && (
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-neutral-100">Step 4: Active Room Zones</h4>
                <p className="text-xs text-neutral-400 mt-1">
                  We have pre-configured {zones.length} default zones (Desk, Chair, Lounge, Door). You can customize them in the Zones tab anytime.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                {zones.map((z) => (
                  <span
                    key={z.id}
                    style={{ borderColor: z.color, color: z.color }}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg border bg-neutral-950"
                  >
                    {z.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Step 5: Configure Inactivity Threshold */}
          {step === 5 && (
            <div className="space-y-4 max-w-md mx-auto w-full">
              <h4 className="text-sm font-semibold text-neutral-100 text-center">
                Step 5: Stationary Inactivity Threshold
              </h4>
              <p className="text-xs text-neutral-400 text-center">
                Configure when the system should raise an alert if a person remains completely stationary.
              </p>
              <div>
                <div className="flex items-center justify-between text-xs text-neutral-300 mb-1">
                  <span>Threshold</span>
                  <span className="font-mono text-emerald-400 font-bold">{inactivityMinutes} Minutes</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="60"
                  step="5"
                  value={inactivityMinutes}
                  onChange={(e) => setInactivityMinutes(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Step 6: Start Monitoring */}
          {step === 6 && (
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-neutral-100">Step 6: Ready to Monitor</h4>
                <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                  Edge spatial intelligence is configured. Privacy guarantees are strictly enforced.
                </p>
              </div>
              <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800 text-xs text-emerald-400 max-w-xs mx-auto">
                ✓ Anonymous Tracking Active · Zero Video Upload
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-4 border-t border-neutral-800 flex items-center justify-between bg-neutral-950/40">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          {step < 6 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
            >
              <span>Next Step</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors shadow-lg"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Start Spatial Monitoring</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

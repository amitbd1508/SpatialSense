import React from 'react';
import { AlertTriangle, Check, ShieldAlert } from 'lucide-react';
import { RoomStatus, ActivityEvent } from '../types/index.ts';
import { NavTab } from './Sidebar.tsx';

interface TopBarProps {
  currentTab: NavTab;
  status: RoomStatus | null;
  onSimulateFall: () => void;
  onAcknowledgeAlert: (id: string) => void;
  isSimulating: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentTab,
  status,
  onSimulateFall,
  onAcknowledgeAlert,
  isSimulating,
}) => {
  const tabTitles: Record<NavTab, { title: string; subtitle: string }> = {
    dashboard: {
      title: 'Executive Dashboard',
      subtitle: 'Real-time occupancy, posture distribution, and safety events',
    },
    live: {
      title: 'Live Spatial Monitor',
      subtitle: 'Edge computer-vision overlay and posture tracking',
    },
    activity: {
      title: 'Activity & Ergonomics',
      subtitle: 'Sitting sessions, standing duration, and daily wellness statistics',
    },
    heatmap: {
      title: 'Movement Heatmap',
      subtitle: '2D spatial density raster of accumulated presence points',
    },
    events: {
      title: 'Activity Timeline',
      subtitle: 'Filterable log of spatial movements, zone transitions, and alerts',
    },
    zones: {
      title: 'Room Zones Configuration',
      subtitle: 'Configure geometric boundaries for desks, chairs, and doors',
    },
    settings: {
      title: 'System & Edge Settings',
      subtitle: 'Thresholds, sensor abstraction, and privacy parameters',
    },
  };

  const activeAlert = status?.activeAlert;

  return (
    <header className="border-b border-neutral-800 bg-neutral-900/90 backdrop-blur-sm sticky top-0 z-30">
      {/* Critical Alert Bar if potential fall or warning */}
      {activeAlert && !activeAlert.acknowledged && (
        <div
          role="alert"
          className={`px-6 py-2.5 flex items-center justify-between transition-colors ${
            activeAlert.event_type === 'POTENTIAL_FALL'
              ? 'bg-rose-950/80 border-b border-rose-800 text-rose-200'
              : 'bg-amber-950/80 border-b border-amber-800 text-amber-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle
              className={`w-5 h-5 shrink-0 ${
                activeAlert.event_type === 'POTENTIAL_FALL'
                  ? 'text-rose-400 animate-bounce'
                  : 'text-amber-400'
              }`}
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider">
                {activeAlert.event_type === 'POTENTIAL_FALL'
                  ? 'Safety Alert: Potential Fall Detected'
                  : 'Notice: Prolonged Inactivity Detected'}
              </p>
              <p className="text-xs opacity-90">
                {activeAlert.metadata?.reason ||
                  `Observed at ${activeAlert.zone_name || 'Room area'}. Please verify individual well-being.`}
              </p>
            </div>
          </div>
          <button
            onClick={() => onAcknowledgeAlert(activeAlert.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Acknowledge</span>
          </button>
        </div>
      )}

      {/* Main Top Bar */}
      <div className="h-16 px-6 flex items-center justify-between">
        {/* Zone 1 & 2: Breadcrumb & Title */}
        <div>
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <span>SpatialSense</span>
            <span aria-hidden="true">/</span>
            <span className="text-neutral-300 font-medium capitalize">{currentTab}</span>
          </div>
          <h2 className="text-base font-semibold text-neutral-100 leading-tight">
            {tabTitles[currentTab]?.title || 'SpatialSense'}
          </h2>
        </div>

        {/* Zone 3: Actions & Status metadata */}
        <div className="flex items-center gap-4">
          <div className="hidden lg:flex items-center gap-3 text-xs text-neutral-400">
            <span>Raspberry Pi Node</span>
            <span aria-hidden="true">·</span>
            <span>CV Engine 10 FPS</span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Edge Active
            </span>
          </div>

          {/* Test Fall Trigger */}
          <button
            onClick={onSimulateFall}
            disabled={isSimulating}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 active:bg-rose-500/20 transition-colors whitespace-nowrap"
            title="Test the fall detection rule by injecting a simulated horizontal posture transition"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>{isSimulating ? 'Simulating...' : 'Test Fall Event'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};

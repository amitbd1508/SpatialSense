import React from 'react';
import {
  Users,
  Armchair,
  Footprints,
  Clock,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Maximize2,
} from 'lucide-react';
import { RoomStatus, DailyStatistics, ActivityEvent, Zone } from '../types/index.ts';
import { formatDuration } from '../utils.ts';
import { NavTab } from './Sidebar.tsx';

interface DashboardViewProps {
  status: RoomStatus | null;
  stats: DailyStatistics | null;
  events: ActivityEvent[];
  zones: Zone[];
  onNavigate: (tab: NavTab) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  status,
  stats,
  events,
  zones,
  onNavigate,
}) => {
  const isOccupied = status?.isOccupied ?? false;

  const totalOccupied = stats?.totalOccupiedSeconds || 0;
  const sittingSecs = stats?.sittingSeconds || 0;
  const standingSecs = stats?.standingSeconds || 0;
  const walkingSecs = stats?.walkingSeconds || 0;

  // Percentage calculations
  const totalPosture = sittingSecs + standingSecs + walkingSecs || 1;
  const sittingPct = Math.round((sittingSecs / totalPosture) * 100);
  const standingPct = Math.round((standingSecs / totalPosture) * 100);
  const walkingPct = Math.round((walkingSecs / totalPosture) * 100);

  return (
    <div className="space-y-6">
      {/* Top Hero Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Room Status */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium uppercase tracking-wider">Room Status</span>
            <Users className="w-4 h-4 text-neutral-400" />
          </div>

          <div className="my-3">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isOccupied ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]' : 'bg-neutral-600'
                }`}
              />
              <span className="text-2xl font-bold text-neutral-100">
                {isOccupied ? 'Occupied' : 'Vacant'}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-neutral-400">
              <span>{status?.currentZone?.name || 'Open Area'}</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-400 font-medium">{status?.currentActivity || 'None'}</span>
            </div>
          </div>

          <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs text-neutral-400">
            <span>Current Session</span>
            <span className="font-mono tabular-nums text-neutral-200">
              {formatDuration(status?.sessionDurationSeconds || 0)}
            </span>
          </div>
        </div>

        {/* Card 2: Sitting Today */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium uppercase tracking-wider">Sitting Today</span>
            <Armchair className="w-4 h-4 text-emerald-400" />
          </div>

          <div className="my-3">
            <div className="text-2xl font-bold font-mono tabular-nums text-neutral-100">
              {formatDuration(sittingSecs)}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-neutral-400">
              <span>{sittingPct}% of day's time</span>
              <span aria-hidden="true">·</span>
              <span>Longest: {formatDuration(stats?.longestSittingSeconds || 0)}</span>
            </div>
          </div>

          <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs text-neutral-400">
            <span>Avg Session Length</span>
            <span className="font-mono tabular-nums text-neutral-200">
              {formatDuration(stats?.averageSittingSeconds || 45 * 60)}
            </span>
          </div>
        </div>

        {/* Card 3: Movement & Standing */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium uppercase tracking-wider">Movement & Standing</span>
            <Footprints className="w-4 h-4 text-sky-400" />
          </div>

          <div className="my-3">
            <div className="text-2xl font-bold font-mono tabular-nums text-neutral-100">
              {formatDuration(standingSecs + walkingSecs)}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-neutral-400">
              <span>Standing: {formatDuration(standingSecs)}</span>
              <span aria-hidden="true">·</span>
              <span>Walking: {formatDuration(walkingSecs)}</span>
            </div>
          </div>

          <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs text-neutral-400">
            <span>Active Mobility</span>
            <span className="font-mono tabular-nums text-neutral-200">
              {standingPct + walkingPct}% active
            </span>
          </div>
        </div>

        {/* Card 4: Occupancy & Alerts */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium uppercase tracking-wider">Total Occupancy</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>

          <div className="my-3">
            <div className="text-2xl font-bold font-mono tabular-nums text-neutral-100">
              {formatDuration(totalOccupied)}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-neutral-400">
              <span>First: {stats?.firstPresenceTime || '--:--'}</span>
              <span aria-hidden="true">·</span>
              <span>Sessions: {stats?.sessionsCount || 1}</span>
            </div>
          </div>

          <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs">
            <span className="text-neutral-400">Safety Events</span>
            <span
              className={`font-semibold ${
                (stats?.fallsDetectedCount || 0) > 0 ? 'text-rose-400' : 'text-neutral-400'
              }`}
            >
              {(stats?.fallsDetectedCount || 0) > 0
                ? `${stats?.fallsDetectedCount} Fall(s) Observed`
                : 'All nominal'}
            </span>
          </div>
        </div>
      </div>

      {/* Middle Section: Posture Distribution & Spatial Mini Map */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Posture Distribution Card */}
        <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-neutral-100">Today's Activity Distribution</h3>
              <p className="text-xs text-neutral-400">Accumulated ergonomic time by posture state</p>
            </div>
            <button
              onClick={() => onNavigate('activity')}
              className="text-xs text-neutral-400 hover:text-neutral-200 flex items-center gap-1 transition-colors"
            >
              <span>Detailed view</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Segmented Distribution Bar */}
          <div className="h-4 w-full bg-neutral-800 rounded-full overflow-hidden flex my-4">
            <div
              style={{ width: `${sittingPct}%` }}
              className="bg-emerald-500 hover:opacity-90 transition-all"
              title={`Sitting: ${sittingPct}%`}
            />
            <div
              style={{ width: `${standingPct}%` }}
              className="bg-sky-500 hover:opacity-90 transition-all"
              title={`Standing: ${standingPct}%`}
            />
            <div
              style={{ width: `${walkingPct}%` }}
              className="bg-purple-500 hover:opacity-90 transition-all"
              title={`Walking: ${walkingPct}%`}
            />
          </div>

          {/* Legend Items */}
          <div className="grid grid-cols-3 gap-4 pt-2">
            <div className="p-3 bg-neutral-950/60 rounded-lg border border-neutral-800/80">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-xs text-neutral-400">Sitting</span>
              </div>
              <div className="text-lg font-semibold font-mono tabular-nums text-neutral-100">
                {formatDuration(sittingSecs)}
              </div>
              <div className="text-[11px] text-neutral-400">{sittingPct}% of active time</div>
            </div>

            <div className="p-3 bg-neutral-950/60 rounded-lg border border-neutral-800/80">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                <span className="text-xs text-neutral-400">Standing</span>
              </div>
              <div className="text-lg font-semibold font-mono tabular-nums text-neutral-100">
                {formatDuration(standingSecs)}
              </div>
              <div className="text-[11px] text-neutral-400">{standingPct}% of active time</div>
            </div>

            <div className="p-3 bg-neutral-950/60 rounded-lg border border-neutral-800/80">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                <span className="text-xs text-neutral-400">Walking</span>
              </div>
              <div className="text-lg font-semibold font-mono tabular-nums text-neutral-100">
                {formatDuration(walkingSecs)}
              </div>
              <div className="text-[11px] text-neutral-400">{walkingPct}% of active time</div>
            </div>
          </div>
        </div>

        {/* Spatial Mini Map / Live Room Floorplan */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-neutral-100">Room Spatial Presence</h3>
              <p className="text-xs text-neutral-400">Real-time coordinates & zone layout</p>
            </div>
            <button
              onClick={() => onNavigate('live')}
              className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-neutral-200 transition-colors"
              title="Open Live Monitor"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

          {/* Scaled 2D Room Floorplan Box */}
          <div className="relative aspect-4/3 w-full bg-neutral-950 rounded-lg border border-neutral-800 overflow-hidden">
            {/* Grid Lines */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#262626_1px,transparent_1px),linear-gradient(to_bottom,#262626_1px,transparent_1px)] bg-[size:16px_16px] opacity-20" />

            {/* Configured Zones */}
            {zones.map((zone) => (
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
                className="absolute border border-dashed rounded flex items-center justify-center pointer-events-none"
              >
                <span
                  style={{ color: zone.color }}
                  className="text-[9px] font-medium tracking-tight px-1 py-0.5 bg-neutral-950/80 rounded"
                >
                  {zone.name}
                </span>
              </div>
            ))}

            {/* Current Person Indicator */}
            {status?.position && isOccupied && (
              <div
                style={{
                  left: `${status.position.x * 100}%`,
                  top: `${status.position.y * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                className="absolute transition-all duration-300 pointer-events-none"
              >
                <div className="w-4 h-4 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)] border-2 border-white flex items-center justify-center animate-pulse" />
                <div className="absolute top-5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-neutral-900 border border-neutral-700 text-[10px] text-neutral-200 rounded whitespace-nowrap shadow-sm">
                  {status.currentPersonId || 'person_001'} ({status.currentActivity})
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-neutral-400">
            <span>Tracking: {status?.currentPersonId || 'person_001'}</span>
            <button
              onClick={() => onNavigate('heatmap')}
              className="text-emerald-400 hover:underline text-xs"
            >
              View 2D Heatmap →
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent Activity Timeline Snapshot */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-neutral-100">Recent Activity Timeline</h3>
            <p className="text-xs text-neutral-400">Latest spatial observations and zone crossings</p>
          </div>
          <button
            onClick={() => onNavigate('events')}
            className="text-xs text-neutral-400 hover:text-neutral-200 flex items-center gap-1 transition-colors"
          >
            <span>View all events</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="divide-y divide-neutral-800/80">
          {events.slice(0, 5).map((evt) => {
            const timeStr = evt.timestamp.split('T')[1]?.substring(0, 8) || evt.timestamp;
            const isAlert = evt.event_type === 'POTENTIAL_FALL' || evt.event_type === 'PROLONGED_INACTIVITY';

            return (
              <div key={evt.id} className="py-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-mono tabular-nums text-neutral-400 w-16">{timeStr}</span>
                  <span
                    className={`font-medium ${
                      isAlert ? 'text-rose-400' : 'text-neutral-200'
                    }`}
                  >
                    {evt.event_type.replace(/_/g, ' ')}
                  </span>
                  {evt.zone_name && (
                    <span className="text-neutral-400">in {evt.zone_name}</span>
                  )}
                  {evt.duration && (
                    <span className="text-neutral-400">
                      (Duration: {formatDuration(evt.duration)})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-neutral-400">
                    Confidence: {Math.round(evt.confidence * 100)}%
                  </span>
                  {isAlert && !evt.acknowledged && (
                    <span className="text-rose-400 font-medium">Unacknowledged</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

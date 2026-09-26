import React, { useState } from 'react';
import {
  Armchair,
  Footprints,
  Clock,
  Sparkles,
  Layers,
  TrendingUp,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import { DailyStatistics, Zone } from '../types/index.ts';
import { formatDuration } from '../utils.ts';
import { api } from '../api.ts';

interface ActivityViewProps {
  stats: DailyStatistics | null;
  zones: Zone[];
}

export const ActivityView: React.FC<ActivityViewProps> = ({ stats, zones }) => {
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleGenerateSummary = async () => {
    try {
      setLoadingAi(true);
      setAiError(null);
      const res = await api.getAiSummary();
      setAiSummary(res.summary);
    } catch (err: any) {
      setAiError(err.message || 'AI Summary currently requires GEMINI_API_KEY set in .env');
    } finally {
      setLoadingAi(false);
    }
  };

  const sittingSecs = stats?.sittingSeconds || 0;
  const standingSecs = stats?.standingSeconds || 0;
  const walkingSecs = stats?.walkingSeconds || 0;
  const totalOccupied = stats?.totalOccupiedSeconds || 0;

  const totalPosture = sittingSecs + standingSecs + walkingSecs || 1;
  const sittingPct = Math.round((sittingSecs / totalPosture) * 100);
  const standingPct = Math.round((standingSecs / totalPosture) * 100);
  const walkingPct = Math.round((walkingSecs / totalPosture) * 100);

  return (
    <div className="space-y-6">
      {/* Top 3 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sitting Time Card */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <div className="flex items-center justify-between text-neutral-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Sitting Today</span>
            <Armchair className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-bold font-mono tabular-nums text-neutral-100">
            {formatDuration(sittingSecs)}
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            {sittingPct}% of today's active time
          </p>

          <div className="mt-6 pt-4 border-t border-neutral-800 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Longest Session:</span>
              <span className="font-mono tabular-nums text-neutral-200">
                {formatDuration(stats?.longestSittingSeconds || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Average Session:</span>
              <span className="font-mono tabular-nums text-neutral-200">
                {formatDuration(stats?.averageSittingSeconds || 45 * 60)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Sitting Intervals:</span>
              <span className="font-mono tabular-nums text-neutral-200">
                {stats?.sessionsCount || 1} distinct sessions
              </span>
            </div>
          </div>
        </div>

        {/* Active Mobility Card */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <div className="flex items-center justify-between text-neutral-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Standing & Mobility</span>
            <Footprints className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-3xl font-bold font-mono tabular-nums text-neutral-100">
            {formatDuration(standingSecs + walkingSecs)}
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            {standingPct + walkingPct}% active ergonomic mobility
          </p>

          <div className="mt-6 pt-4 border-t border-neutral-800 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Standing Time:</span>
              <span className="font-mono tabular-nums text-neutral-200">
                {formatDuration(standingSecs)} ({standingPct}%)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Walking / Transition:</span>
              <span className="font-mono tabular-nums text-neutral-200">
                {formatDuration(walkingSecs)} ({walkingPct}%)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Posture Variation Ratio:</span>
              <span className="font-mono tabular-nums text-emerald-400">
                {(totalPosture / Math.max(1, sittingSecs)).toFixed(2)}x
              </span>
            </div>
          </div>
        </div>

        {/* Room Occupancy Card */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <div className="flex items-center justify-between text-neutral-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Room Occupancy</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-bold font-mono tabular-nums text-neutral-100">
            {formatDuration(totalOccupied)}
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Total presence accumulated today
          </p>

          <div className="mt-6 pt-4 border-t border-neutral-800 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">First Presence:</span>
              <span className="font-mono tabular-nums text-neutral-200">
                {stats?.firstPresenceTime || '--:--'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Last Presence:</span>
              <span className="font-mono tabular-nums text-neutral-200">
                {stats?.lastPresenceTime || 'Active'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Daily Presence Sessions:</span>
              <span className="font-mono tabular-nums text-neutral-200">
                {stats?.sessionsCount || 1} entries
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Zone Dwell Breakdown Grid */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-neutral-100 mb-1">Room Zone Utilization</h3>
        <p className="text-xs text-neutral-400 mb-6">
          Time spent inside each calibrated room zone today
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {zones.map((zone) => {
            const usageSecs = stats?.zoneUsageSeconds?.[zone.id] || 0;
            const pct = totalOccupied > 0 ? Math.round((usageSecs / totalOccupied) * 100) : 0;

            return (
              <div
                key={zone.id}
                className="p-4 bg-neutral-950/60 rounded-xl border border-neutral-800/80 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      style={{ color: zone.color }}
                      className="text-xs font-semibold tracking-wide uppercase"
                    >
                      {zone.name}
                    </span>
                    <span className="text-[11px] text-neutral-400">({zone.type})</span>
                  </div>
                  <div className="text-xl font-bold font-mono tabular-nums text-neutral-100">
                    {formatDuration(usageSecs)}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="w-full bg-neutral-800 rounded-full h-1.5 overflow-hidden mb-1">
                    <div
                      style={{ width: `${Math.min(100, pct)}%`, backgroundColor: zone.color }}
                      className="h-full rounded-full transition-all"
                    />
                  </div>
                  <span className="text-[11px] text-neutral-400">{pct}% of room time</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Gemini AI Privacy-Safe Activity Report */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-neutral-100">
                Privacy-Preserving Spatial Activity Report
              </h3>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Synthesizes structured timeline metadata into natural-language ergonomic and wellness insights (Zero video shared).
            </p>
          </div>

          <button
            onClick={handleGenerateSummary}
            disabled={loadingAi}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold border border-neutral-700 transition-colors"
          >
            <Sparkles className={`w-3.5 h-3.5 text-amber-400 ${loadingAi ? 'animate-spin' : ''}`} />
            <span>{loadingAi ? 'Analyzing Metadata...' : 'Generate AI Summary'}</span>
          </button>
        </div>

        {aiError && (
          <div className="p-3 bg-amber-950/40 border border-amber-800/80 rounded-lg text-xs text-amber-300">
            {aiError}
          </div>
        )}

        {aiSummary ? (
          <div className="p-4 bg-neutral-950 rounded-lg border border-neutral-800 text-xs text-neutral-300 leading-relaxed whitespace-pre-line font-sans">
            {aiSummary}
          </div>
        ) : (
          !aiError && (
            <div className="p-4 bg-neutral-950/50 rounded-lg border border-neutral-800/60 text-xs text-neutral-400">
              Click &quot;Generate AI Summary&quot; to produce an automated daily ergonomics and room utilization overview using pure metadata events.
            </div>
          )
        )}
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import {
  ListFilter,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Filter,
  Check,
  Clock,
} from 'lucide-react';
import { ActivityEvent, EventType } from '../types/index.ts';
import { formatDuration } from '../utils.ts';
import { api } from '../api.ts';

interface EventsViewProps {
  events: ActivityEvent[];
  onAcknowledge: (id: string) => void;
}

export const EventsView: React.FC<EventsViewProps> = ({ events, onAcknowledge }) => {
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | '7days'>('today');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'ALERTS' | 'POSTURE' | 'PRESENCE'>('ALL');

  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const filteredEvents = events.filter((evt) => {
    const evtDate = evt.timestamp ? evt.timestamp.split('T')[0] : todayStr;

    // Date filter
    if (dateFilter === 'today' && evtDate !== todayStr) return false;
    if (dateFilter === 'yesterday' && evtDate !== yesterdayStr) return false;

    // Type filter
    const isAlert = evt.event_type === 'POTENTIAL_FALL' || evt.event_type === 'PROLONGED_INACTIVITY';
    const isPosture = [
      'SITTING_STARTED',
      'SITTING_ENDED',
      'STANDING_STARTED',
      'WALKING_STARTED',
      'WALKING_ENDED',
    ].includes(evt.event_type);
    const isPresence = ['PERSON_ENTERED', 'PERSON_LEFT', 'ZONE_ENTERED', 'ZONE_LEFT'].includes(
      evt.event_type
    );

    if (typeFilter === 'ALERTS' && !isAlert) return false;
    if (typeFilter === 'POSTURE' && !isPosture) return false;
    if (typeFilter === 'PRESENCE' && !isPresence) return false;

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        {/* Date Filter Tabs */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400">Date Range:</span>
          <div className="flex items-center p-1 bg-neutral-950 rounded-lg border border-neutral-800">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: '7days', label: 'Last 7 Days' },
            ].map((d) => (
              <button
                key={d.id}
                onClick={() => setDateFilter(d.id as any)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  dateFilter === d.id
                    ? 'bg-neutral-800 text-white'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Event Category Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400">Event Class:</span>
          <div className="flex items-center p-1 bg-neutral-950 rounded-lg border border-neutral-800">
            {[
              { id: 'ALL', label: 'All Events' },
              { id: 'POSTURE', label: 'Posture' },
              { id: 'PRESENCE', label: 'Presence/Zones' },
              { id: 'ALERTS', label: 'Alerts' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTypeFilter(t.id as any)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  typeFilter === t.id
                    ? 'bg-neutral-800 text-white'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Events Stream Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between text-xs text-neutral-400 bg-neutral-950/40">
          <span>Displaying {filteredEvents.length} chronological events</span>
          <span>Anonymous Observation Pipeline</span>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="p-12 text-center text-xs text-neutral-400">
            No events match the selected filter criteria.
          </div>
        ) : (
          <div className="divide-y divide-neutral-800/80">
            {filteredEvents.map((evt) => {
              const timeStr = evt.timestamp?.includes('T')
                ? evt.timestamp.split('T')[1]?.substring(0, 8)
                : evt.timestamp || '--:--:--';
              const dateStr = evt.timestamp?.includes('T')
                ? evt.timestamp.split('T')[0]
                : todayStr;
              const isAlert = evt.event_type === 'POTENTIAL_FALL' || evt.event_type === 'PROLONGED_INACTIVITY';

              return (
                <div
                  key={evt.id}
                  className={`p-4 flex flex-wrap items-center justify-between gap-4 transition-colors ${
                    isAlert && !evt.acknowledged
                      ? 'bg-rose-950/20 hover:bg-rose-950/30'
                      : 'hover:bg-neutral-800/30'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Timestamp */}
                    <div className="w-24 shrink-0">
                      <div className="font-mono text-xs text-neutral-200 tabular-nums font-semibold">
                        {timeStr}
                      </div>
                      <div className="text-[10px] text-neutral-400">{dateStr}</div>
                    </div>

                    {/* Event Tag */}
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-semibold ${
                          evt.event_type === 'POTENTIAL_FALL'
                            ? 'text-rose-400'
                            : evt.event_type === 'PROLONGED_INACTIVITY'
                            ? 'text-amber-400'
                            : evt.event_type.includes('SITTING')
                            ? 'text-emerald-400'
                            : evt.event_type.includes('STANDING')
                            ? 'text-sky-400'
                            : 'text-neutral-200'
                        }`}
                      >
                        {evt.event_type.replace(/_/g, ' ')}
                      </span>

                      {evt.zone_name && (
                        <span className="text-xs text-neutral-400">
                          in <strong className="text-neutral-300 font-medium">{evt.zone_name}</strong>
                        </span>
                      )}

                      {evt.duration && (
                        <span className="text-xs text-neutral-400">
                          (Duration: {formatDuration(evt.duration)})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Metadata & Action */}
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-neutral-400 font-mono">
                      Conf: {Math.round(evt.confidence * 100)}%
                    </span>

                    {isAlert && (
                      <div>
                        {evt.acknowledged ? (
                          <span className="flex items-center gap-1 text-neutral-400">
                            <CheckCircle className="w-3.5 h-3.5 text-neutral-400" />
                            <span>Acknowledged</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => onAcknowledge(evt.id)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-semibold transition-colors"
                          >
                            <Check className="w-3 h-3" />
                            <span>Acknowledge</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

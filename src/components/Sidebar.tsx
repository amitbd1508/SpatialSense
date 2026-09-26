import React from 'react';
import {
  LayoutDashboard,
  Radio,
  Clock,
  Flame,
  ListFilter,
  Layers,
  Settings,
  ShieldCheck,
  Sparkles,
  Eye,
  EyeOff,
} from 'lucide-react';
import { RoomStatus } from '../types/index.ts';

export type NavTab =
  | 'dashboard'
  | 'live'
  | 'activity'
  | 'heatmap'
  | 'events'
  | 'zones'
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  status: RoomStatus | null;
  onOpenWizard: () => void;
  isMiniViewOpen?: boolean;
  onToggleMiniView?: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  status,
  onOpenWizard,
  isMiniViewOpen,
  onToggleMiniView,
}) => {
  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'live' as NavTab, label: 'Live Monitor', icon: Radio },
    { id: 'activity' as NavTab, label: 'Activity', icon: Clock },
    { id: 'heatmap' as NavTab, label: 'Heatmap', icon: Flame },
    { id: 'events' as NavTab, label: 'Events', icon: ListFilter },
    { id: 'zones' as NavTab, label: 'Zones', icon: Layers },
    { id: 'settings' as NavTab, label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-neutral-900 border-r border-neutral-800 flex flex-col shrink-0 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-neutral-100 tracking-tight leading-none">
              SpatialSense
            </h1>
            <p className="text-[11px] text-neutral-400 mt-1">Spatial Intelligence</p>
          </div>
        </div>
      </div>

      {/* Room Live Mini Status */}
      <div className="mx-4 mt-4 p-3 bg-neutral-950/60 rounded-lg border border-neutral-800/80">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-neutral-400">Room Status</span>
          <span className="flex items-center gap-1.5 text-xs font-medium">
            <span
              className={`w-2 h-2 rounded-full ${
                status?.isOccupied ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-neutral-600'
              }`}
            />
            <span className={status?.isOccupied ? 'text-emerald-400' : 'text-neutral-400'}>
              {status?.isOccupied ? 'Occupied' : 'Vacant'}
            </span>
          </span>
        </div>
        {status?.isOccupied && (
          <div className="text-[11px] text-neutral-400 flex items-center gap-2">
            <span>{status.currentZone?.name || 'Open Area'}</span>
            <span aria-hidden="true">·</span>
            <span className="text-neutral-200 font-medium">{status.currentActivity}</span>
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                isActive
                  ? 'bg-neutral-800 text-white font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-neutral-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}

        {/* Quick Mini Live Window Toggle in Sidebar */}
        {onToggleMiniView && (
          <div className="pt-2 border-t border-neutral-800/60 mt-2">
            <button
              onClick={() => onToggleMiniView(!isMiniViewOpen)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
                isMiniViewOpen
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'border-neutral-800/80 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
              }`}
            >
              <div className="flex items-center gap-2">
                {isMiniViewOpen ? (
                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5 text-neutral-400" />
                )}
                <span>Mini Live View</span>
              </div>
              <span
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                  isMiniViewOpen
                    ? 'bg-emerald-500 text-neutral-950'
                    : 'bg-neutral-800 text-neutral-400'
                }`}
              >
                {isMiniViewOpen ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>
        )}
      </nav>

      {/* Setup Wizard Trigger & Privacy Badge */}
      <div className="p-4 border-t border-neutral-800 space-y-3">
        <button
          onClick={onOpenWizard}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg transition-colors border border-neutral-700/60"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Room Setup Wizard</span>
        </button>

        <div className="flex items-center gap-2 text-[11px] text-neutral-400 pt-1">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="leading-tight">
            <span>Edge privacy enforced</span>
            <span className="block text-[10px] text-neutral-400">Zero cloud video storage</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

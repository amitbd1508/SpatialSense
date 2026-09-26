import React, { useState, useEffect } from 'react';
import { Sidebar, NavTab } from './components/Sidebar.tsx';
import { TopBar } from './components/TopBar.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { LiveMonitorView } from './components/LiveMonitorView.tsx';
import { ActivityView } from './components/ActivityView.tsx';
import { HeatmapView } from './components/HeatmapView.tsx';
import { EventsView } from './components/EventsView.tsx';
import { ZonesView } from './components/ZonesView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { SetupWizardModal } from './components/SetupWizardModal.tsx';
import { MiniLiveView } from './components/MiniLiveView.tsx';
import {
  RoomStatus,
  DailyStatistics,
  ActivityEvent,
  Zone,
  RoomSettings,
} from './types/index.ts';
import { api } from './api.ts';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [status, setStatus] = useState<RoomStatus | null>(null);
  const [stats, setStats] = useState<DailyStatistics | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [settings, setSettings] = useState<RoomSettings | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);
  const [isSimulatingFall, setIsSimulatingFall] = useState<boolean>(false);
  const [isMiniViewOpen, setIsMiniViewOpen] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('spatialsense_mini_view');
      return stored === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleMiniView = (open: boolean) => {
    setIsMiniViewOpen(open);
    try {
      localStorage.setItem('spatialsense_mini_view', open ? 'true' : 'false');
    } catch {}
  };

  // Initial load
  const loadInitialData = async () => {
    try {
      const [statusRes, statsRes, eventsRes, zonesRes, settingsRes] = await Promise.all([
        api.getStatus(),
        api.getTodayActivity(),
        api.getEvents(100),
        api.getZones(),
        api.getSettings(),
      ]);
      setStatus(statusRes.status);
      setStats(statsRes);
      setEvents(eventsRes);
      setZones(zonesRes);
      setSettings(settingsRes);
    } catch (err) {
      console.error('Error loading initial app state:', err);
    }
  };

  useEffect(() => {
    loadInitialData();

    // High frequency telemetry polling (every 1s) for live room status
    const statusInterval = setInterval(async () => {
      try {
        const res = await api.getStatus();
        setStatus(res.status);
      } catch {
        // Silently fail on network disconnect
      }
    }, 1000);

    // Medium frequency polling for stats & events (every 3s)
    const statsInterval = setInterval(async () => {
      try {
        const [todayStats, latestEvents] = await Promise.all([
          api.getTodayActivity(),
          api.getEvents(100),
        ]);
        setStats(todayStats);
        setEvents(latestEvents);
      } catch {
        // Silently fail
      }
    }, 3000);

    return () => {
      clearInterval(statusInterval);
      clearInterval(statsInterval);
    };
  }, []);

  const handleSimulateFall = async () => {
    try {
      setIsSimulatingFall(true);
      await api.simulateFall();
      const updatedStatus = await api.getStatus();
      const updatedEvents = await api.getEvents(100);
      setStatus(updatedStatus.status);
      setEvents(updatedEvents);
    } catch (err) {
      console.error('Failed to simulate fall:', err);
    } finally {
      setIsSimulatingFall(false);
    }
  };

  const handleAcknowledgeAlert = async (id: string) => {
    try {
      await api.acknowledgeEvent(id);
      const updatedStatus = await api.getStatus();
      const updatedEvents = await api.getEvents(100);
      setStatus(updatedStatus.status);
      setEvents(updatedEvents);
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  const handleZonesChanged = async () => {
    try {
      const updatedZones = await api.getZones();
      setZones(updatedZones);
    } catch (err) {
      console.error('Failed to reload zones:', err);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-neutral-950 text-neutral-100 font-sans">
      {/* Navigation Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        status={status}
        onOpenWizard={() => setIsWizardOpen(true)}
        isMiniViewOpen={isMiniViewOpen}
        onToggleMiniView={handleToggleMiniView}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar
          currentTab={currentTab}
          status={status}
          onSimulateFall={handleSimulateFall}
          onAcknowledgeAlert={handleAcknowledgeAlert}
          isSimulating={isSimulatingFall}
          isMiniViewOpen={isMiniViewOpen}
          onToggleMiniView={handleToggleMiniView}
        />

        <main className="flex-1 overflow-y-auto p-6 max-w-7xl w-full mx-auto">
          {currentTab === 'dashboard' && (
            <DashboardView
              status={status}
              stats={stats}
              events={events}
              zones={zones}
              onNavigate={setCurrentTab}
            />
          )}

          {currentTab === 'live' && (
            <LiveMonitorView
              status={status}
              zones={zones}
              onSimulateFall={handleSimulateFall}
              isSimulating={isSimulatingFall}
            />
          )}

          {currentTab === 'activity' && <ActivityView stats={stats} zones={zones} />}

          {currentTab === 'heatmap' && <HeatmapView zones={zones} />}

          {currentTab === 'events' && (
            <EventsView events={events} onAcknowledge={handleAcknowledgeAlert} />
          )}

          {currentTab === 'zones' && (
            <ZonesView zones={zones} onZonesChanged={handleZonesChanged} />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              settings={settings}
              onSettingsSaved={setSettings}
              status={status}
            />
          )}
        </main>
      </div>

      {/* Setup Wizard Modal */}
      <SetupWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onComplete={loadInitialData}
        zones={zones}
        settings={settings}
      />

      {/* Persistent Floating Low-Res Mini Live View Window */}
      <MiniLiveView
        isOpen={isMiniViewOpen}
        onToggle={handleToggleMiniView}
        status={status}
        zones={zones}
      />
    </div>
  );
}

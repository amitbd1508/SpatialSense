import {
  Zone,
  RoomSettings,
  ActivityEvent,
  DailyStatistics,
  RoomStatus,
  StandardObservation,
  CameraDevice,
  CameraConfig,
} from './types/index.ts';

const API_BASE = '/api';

export const api = {
  async getHealth() {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  },

  async getStatus(): Promise<{ status: RoomStatus; settings: Partial<RoomSettings> }> {
    const res = await fetch(`${API_BASE}/status`);
    if (!res.ok) throw new Error('Failed to fetch status');
    return res.json();
  },

  async getRoom() {
    const res = await fetch(`${API_BASE}/room`);
    if (!res.ok) throw new Error('Failed to fetch room');
    return res.json();
  },

  async getZones(): Promise<Zone[]> {
    const res = await fetch(`${API_BASE}/zones`);
    if (!res.ok) throw new Error('Failed to fetch zones');
    return res.json();
  },

  async createZone(zone: Omit<Zone, 'id'>): Promise<Zone> {
    const res = await fetch(`${API_BASE}/zones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(zone),
    });
    if (!res.ok) throw new Error('Failed to create zone');
    return res.json();
  },

  async updateZone(id: string, partial: Partial<Zone>): Promise<Zone> {
    const res = await fetch(`${API_BASE}/zones/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    });
    if (!res.ok) throw new Error('Failed to update zone');
    return res.json();
  },

  async deleteZone(id: string): Promise<{ success: boolean; id: string }> {
    const res = await fetch(`${API_BASE}/zones/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete zone');
    return res.json();
  },

  async getTodayActivity(): Promise<DailyStatistics> {
    const res = await fetch(`${API_BASE}/activity/today`);
    if (!res.ok) throw new Error('Failed to fetch today activity');
    return res.json();
  },

  async getActivityHistory(): Promise<DailyStatistics[]> {
    const res = await fetch(`${API_BASE}/activity/history`);
    if (!res.ok) throw new Error('Failed to fetch history');
    return res.json();
  },

  async getStatistics() {
    const res = await fetch(`${API_BASE}/statistics`);
    if (!res.ok) throw new Error('Failed to fetch statistics');
    return res.json();
  },

  async getEvents(limit = 100): Promise<ActivityEvent[]> {
    const res = await fetch(`${API_BASE}/events?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch events');
    return res.json();
  },

  async acknowledgeEvent(id: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/events/${id}/acknowledge`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to acknowledge event');
    return res.ok;
  },

  async getHeatmap(limit = 1500): Promise<{ points: any[]; zones: Zone[] }> {
    const res = await fetch(`${API_BASE}/heatmap?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch heatmap');
    return res.json();
  },

  async getSettings(): Promise<RoomSettings> {
    const res = await fetch(`${API_BASE}/settings`);
    if (!res.ok) throw new Error('Failed to fetch settings');
    return res.json();
  },

  async updateSettings(settings: Partial<RoomSettings>): Promise<RoomSettings> {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Failed to update settings');
    return res.json();
  },

  async postObservation(obs: StandardObservation): Promise<void> {
    await fetch(`${API_BASE}/observations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(obs),
    });
  },

  async simulateFall(): Promise<any> {
    const res = await fetch(`${API_BASE}/simulate/fall`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to simulate fall');
    return res.json();
  },

  async getAiSummary(): Promise<{ summary: string; generated_at: string }> {
    const res = await fetch(`${API_BASE}/ai/summary`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to generate summary');
    }
    return res.json();
  },

  async getCameraDevices(): Promise<{
    devices: CameraDevice[];
    active_index: number;
    is_connected: boolean;
    active_resolution: string;
    active_fps: number;
  }> {
    const res = await fetch(`${API_BASE}/camera/devices`);
    if (!res.ok) throw new Error('Failed to fetch camera devices');
    return res.json();
  },

  async getCameraConfig(): Promise<CameraConfig> {
    const res = await fetch(`${API_BASE}/camera/config`);
    if (!res.ok) throw new Error('Failed to fetch camera config');
    return res.json();
  },

  async updateCameraConfig(config: Partial<CameraConfig>): Promise<any> {
    const res = await fetch(`${API_BASE}/camera/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error('Failed to update camera config');
    return res.json();
  },

  async testCameraDevice(cameraIndex: number): Promise<{
    can_open: boolean;
    has_frame: boolean;
    status: string;
  }> {
    const res = await fetch(`${API_BASE}/camera/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ camera_index: cameraIndex }),
    });
    if (!res.ok) throw new Error('Failed to test camera device');
    return res.json();
  },
};

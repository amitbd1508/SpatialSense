import fs from 'fs';
import path from 'path';
import {
  Zone,
  RoomSettings,
  ActivityEvent,
  SpatialPoint,
  DailyStatistics,
  RoomStatus,
} from '../src/types/index.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'spatialsense_db.json');

export interface DatabaseState {
  settings: RoomSettings;
  zones: Zone[];
  events: ActivityEvent[];
  spatialPoints: SpatialPoint[];
  dailyStats: Record<string, DailyStatistics>;
  status: RoomStatus;
}

const DEFAULT_SETTINGS: RoomSettings = {
  roomName: 'Studio Room 101',
  cameraIndex: 0,
  fps: 10,
  detectionConfidence: 0.65,
  inactivityThresholdMinutes: 30,
  fallSensitivity: 0.75,
  privacyMode: 'silhouette_only',
  demoMode: true,
  activeSensor: 'simulation',
};

const DEFAULT_ZONES: Zone[] = [
  {
    id: 'zone-door',
    name: 'Entry Door',
    type: 'door',
    color: '#0284c7', // Sky
    x: 0.05,
    y: 0.55,
    width: 0.16,
    height: 0.38,
  },
  {
    id: 'zone-desk',
    name: 'Work Desk',
    type: 'desk',
    color: '#10b981', // Emerald
    x: 0.58,
    y: 0.15,
    width: 0.36,
    height: 0.42,
  },
  {
    id: 'zone-chair',
    name: 'Ergo Chair',
    type: 'chair',
    color: '#8b5cf6', // Purple
    x: 0.65,
    y: 0.28,
    width: 0.2,
    height: 0.28,
  },
  {
    id: 'zone-lounge',
    name: 'Rest Couch',
    type: 'bed',
    color: '#f59e0b', // Amber
    x: 0.12,
    y: 0.12,
    width: 0.34,
    height: 0.32,
  },
];

const INITIAL_STATUS: RoomStatus = {
  isOccupied: true,
  currentPersonId: 'person_001',
  currentActivity: 'SITTING',
  currentZone: DEFAULT_ZONES[1], // Desk
  sessionDurationSeconds: 42 * 60 + 15,
  activityDurationSeconds: 28 * 60 + 40,
  lastUpdated: new Date().toISOString(),
  position: { x: 0.72, y: 0.35 },
  bbox: { x: 0.64, y: 0.22, width: 0.16, height: 0.26 },
  velocity: 0.02,
  inactivitySeconds: 28 * 60,
  activeAlert: null,
};

function generateSeedEvents(): ActivityEvent[] {
  const today = new Date().toISOString().split('T')[0];
  return [
    {
      id: 'evt-001',
      session_id: 'sess-101',
      tracking_id: 'person_001',
      event_type: 'PERSON_ENTERED',
      zone_id: 'zone-door',
      zone_name: 'Entry Door',
      timestamp: `${today}T08:14:22.000Z`,
      confidence: 0.94,
      acknowledged: true,
    },
    {
      id: 'evt-002',
      session_id: 'sess-101',
      tracking_id: 'person_001',
      event_type: 'ZONE_ENTERED',
      zone_id: 'zone-desk',
      zone_name: 'Work Desk',
      timestamp: `${today}T08:18:05.000Z`,
      confidence: 0.92,
      acknowledged: true,
    },
    {
      id: 'evt-003',
      session_id: 'sess-101',
      tracking_id: 'person_001',
      event_type: 'SITTING_STARTED',
      zone_id: 'zone-desk',
      zone_name: 'Work Desk',
      timestamp: `${today}T08:18:12.000Z`,
      confidence: 0.91,
      acknowledged: true,
    },
    {
      id: 'evt-004',
      session_id: 'sess-101',
      tracking_id: 'person_001',
      event_type: 'SITTING_ENDED',
      zone_id: 'zone-desk',
      zone_name: 'Work Desk',
      timestamp: `${today}T09:45:00.000Z`,
      duration: 5208,
      confidence: 0.89,
      acknowledged: true,
    },
    {
      id: 'evt-005',
      session_id: 'sess-101',
      tracking_id: 'person_001',
      event_type: 'STANDING_STARTED',
      zone_id: 'zone-desk',
      zone_name: 'Work Desk',
      timestamp: `${today}T09:45:02.000Z`,
      confidence: 0.93,
      acknowledged: true,
    },
    {
      id: 'evt-006',
      session_id: 'sess-101',
      tracking_id: 'person_001',
      event_type: 'WALKING_STARTED',
      zone_id: null,
      zone_name: null,
      timestamp: `${today}T09:47:30.000Z`,
      confidence: 0.88,
      acknowledged: true,
    },
    {
      id: 'evt-007',
      session_id: 'sess-101',
      tracking_id: 'person_001',
      event_type: 'ZONE_ENTERED',
      zone_id: 'zone-lounge',
      zone_name: 'Rest Couch',
      timestamp: `${today}T09:50:10.000Z`,
      confidence: 0.9,
      acknowledged: true,
    },
    {
      id: 'evt-008',
      session_id: 'sess-101',
      tracking_id: 'person_001',
      event_type: 'SITTING_STARTED',
      zone_id: 'zone-desk',
      zone_name: 'Work Desk',
      timestamp: `${today}T10:15:00.000Z`,
      confidence: 0.95,
      acknowledged: true,
    },
  ];
}

function generateSeedSpatialPoints(): SpatialPoint[] {
  const points: SpatialPoint[] = [];
  const now = Date.now();
  // Generate a cluster around desk (0.7, 0.3)
  for (let i = 0; i < 180; i++) {
    points.push({
      timestamp: new Date(now - i * 60000).toISOString(),
      x: 0.7 + (Math.random() - 0.5) * 0.12,
      y: 0.32 + (Math.random() - 0.5) * 0.1,
      zone_id: 'zone-desk',
      activity: 'SITTING',
    });
  }
  // Cluster around couch (0.25, 0.25)
  for (let i = 0; i < 60; i++) {
    points.push({
      timestamp: new Date(now - (200 + i) * 60000).toISOString(),
      x: 0.25 + (Math.random() - 0.5) * 0.15,
      y: 0.25 + (Math.random() - 0.5) * 0.1,
      zone_id: 'zone-lounge',
      activity: 'SITTING',
    });
  }
  // Pathway points (between door 0.1, 0.7 and desk 0.7, 0.3)
  for (let i = 0; i < 70; i++) {
    const t = Math.random();
    points.push({
      timestamp: new Date(now - (300 + i) * 60000).toISOString(),
      x: 0.1 + t * 0.6 + (Math.random() - 0.5) * 0.08,
      y: 0.7 - t * 0.35 + (Math.random() - 0.5) * 0.08,
      zone_id: null,
      activity: 'WALKING',
    });
  }
  return points;
}

function generateSeedDailyStats(): Record<string, DailyStatistics> {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  return {
    [today]: {
      date: today,
      totalOccupiedSeconds: 5 * 3600 + 42 * 60, // 5h 42m
      sittingSeconds: 4 * 3600 + 18 * 60,       // 4h 18m
      standingSeconds: 52 * 60,                 // 52m
      walkingSeconds: 32 * 60,                  // 32m
      lyingSeconds: 0,
      unknownSeconds: 0,
      sessionsCount: 3,
      longestSittingSeconds: 1 * 3600 + 35 * 60, // 1h 35m
      averageSittingSeconds: 48 * 60,            // 48m
      firstPresenceTime: '08:14',
      lastPresenceTime: 'Active now',
      fallsDetectedCount: 0,
      inactivityAlertsCount: 0,
      zoneUsageSeconds: {
        'zone-desk': 3 * 3600 + 50 * 60,
        'zone-chair': 3 * 3600 + 20 * 60,
        'zone-lounge': 45 * 60,
        'zone-door': 8 * 60,
      },
    },
    [yesterday]: {
      date: yesterday,
      totalOccupiedSeconds: 7 * 3600 + 13 * 60, // 7h 13m
      sittingSeconds: 5 * 3600 + 42 * 60,       // 5h 42m
      standingSeconds: 1 * 3600 + 12 * 60,      // 1h 12m
      walkingSeconds: 1 * 3600 + 4 * 60,        // 1h 04m
      lyingSeconds: 15 * 60,
      unknownSeconds: 0,
      sessionsCount: 8,
      longestSittingSeconds: 2 * 3600 + 10 * 60,
      averageSittingSeconds: 42 * 60,
      firstPresenceTime: '08:14',
      lastPresenceTime: '17:42',
      fallsDetectedCount: 0,
      inactivityAlertsCount: 1,
      zoneUsageSeconds: {
        'zone-desk': 5 * 3600 + 10 * 60,
        'zone-chair': 4 * 3600 + 30 * 60,
        'zone-lounge': 1 * 3600 + 15 * 60,
        'zone-door': 12 * 60,
      },
    },
  };
}

class Store {
  private state: DatabaseState;

  constructor() {
    this.state = this.load();
  }

  private load(): DatabaseState {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
          zones: parsed.zones?.length ? parsed.zones : DEFAULT_ZONES,
          events: parsed.events?.length ? parsed.events : generateSeedEvents(),
          spatialPoints: parsed.spatialPoints?.length ? parsed.spatialPoints : generateSeedSpatialPoints(),
          dailyStats: parsed.dailyStats || generateSeedDailyStats(),
          status: parsed.status || INITIAL_STATUS,
        };
      }
    } catch (e) {
      console.error('Error loading DB, using defaults:', e);
    }

    const initial: DatabaseState = {
      settings: DEFAULT_SETTINGS,
      zones: DEFAULT_ZONES,
      events: generateSeedEvents(),
      spatialPoints: generateSeedSpatialPoints(),
      dailyStats: generateSeedDailyStats(),
      status: INITIAL_STATUS,
    };
    this.save(initial);
    return initial;
  }

  public save(newState?: DatabaseState): void {
    try {
      if (newState) {
        this.state = newState;
      }
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist DB file:', err);
    }
  }

  public getSettings(): RoomSettings {
    return this.state.settings;
  }

  public updateSettings(partial: Partial<RoomSettings>): RoomSettings {
    this.state.settings = { ...this.state.settings, ...partial };
    this.save();
    return this.state.settings;
  }

  public getZones(): Zone[] {
    return this.state.zones;
  }

  public addZone(zone: Omit<Zone, 'id'>): Zone {
    const newZone: Zone = {
      id: `zone-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ...zone,
    };
    this.state.zones.push(newZone);
    this.save();
    return newZone;
  }

  public updateZone(id: string, partial: Partial<Zone>): Zone | null {
    const index = this.state.zones.findIndex((z) => z.id === id);
    if (index === -1) return null;
    this.state.zones[index] = { ...this.state.zones[index], ...partial };
    this.save();
    return this.state.zones[index];
  }

  public deleteZone(id: string): boolean {
    const prevLen = this.state.zones.length;
    this.state.zones = this.state.zones.filter((z) => z.id !== id);
    if (this.state.zones.length !== prevLen) {
      this.save();
      return true;
    }
    return false;
  }

  public getEvents(limit = 100): ActivityEvent[] {
    return this.state.events.slice(-limit).reverse();
  }

  public addEvent(event: Omit<ActivityEvent, 'id'>): ActivityEvent {
    const newEvent: ActivityEvent = {
      id: `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ...event,
      acknowledged: false,
    };
    this.state.events.push(newEvent);
    // Keep last 1000 events
    if (this.state.events.length > 1000) {
      this.state.events = this.state.events.slice(-1000);
    }
    this.save();
    return newEvent;
  }

  public acknowledgeEvent(id: string): boolean {
    const event = this.state.events.find((e) => e.id === id);
    if (event) {
      event.acknowledged = true;
      if (this.state.status.activeAlert?.id === id) {
        this.state.status.activeAlert = null;
      }
      this.save();
      return true;
    }
    return false;
  }

  public getSpatialPoints(limit = 2000): SpatialPoint[] {
    return this.state.spatialPoints.slice(-limit);
  }

  public addSpatialPoint(pt: SpatialPoint): void {
    this.state.spatialPoints.push(pt);
    if (this.state.spatialPoints.length > 5000) {
      this.state.spatialPoints = this.state.spatialPoints.slice(-5000);
    }
  }

  public getDailyStats(date?: string): DailyStatistics {
    const today = date || new Date().toISOString().split('T')[0];
    if (!this.state.dailyStats[today]) {
      this.state.dailyStats[today] = {
        date: today,
        totalOccupiedSeconds: 0,
        sittingSeconds: 0,
        standingSeconds: 0,
        walkingSeconds: 0,
        lyingSeconds: 0,
        unknownSeconds: 0,
        sessionsCount: 0,
        longestSittingSeconds: 0,
        averageSittingSeconds: 0,
        firstPresenceTime: null,
        lastPresenceTime: null,
        fallsDetectedCount: 0,
        inactivityAlertsCount: 0,
        zoneUsageSeconds: {},
      };
      this.save();
    }
    return this.state.dailyStats[today];
  }

  public updateDailyStats(date: string, partial: Partial<DailyStatistics>): DailyStatistics {
    const current = this.getDailyStats(date);
    this.state.dailyStats[date] = { ...current, ...partial };
    this.save();
    return this.state.dailyStats[date];
  }

  public getHistory(): DailyStatistics[] {
    return Object.values(this.state.dailyStats).sort((a, b) => b.date.localeCompare(a.date));
  }

  public getStatus(): RoomStatus {
    return this.state.status;
  }

  public setStatus(status: RoomStatus): void {
    this.state.status = status;
  }
}

export const store = new Store();

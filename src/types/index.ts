export type ActivityType =
  | 'UNKNOWN'
  | 'STANDING'
  | 'SITTING'
  | 'WALKING'
  | 'LYING'
  | 'POSSIBLE_FALL';

export type EventType =
  | 'PERSON_ENTERED'
  | 'PERSON_LEFT'
  | 'ZONE_ENTERED'
  | 'ZONE_LEFT'
  | 'SITTING_STARTED'
  | 'SITTING_ENDED'
  | 'STANDING_STARTED'
  | 'WALKING_STARTED'
  | 'WALKING_ENDED'
  | 'POTENTIAL_FALL'
  | 'PROLONGED_INACTIVITY';

export type ZoneType =
  | 'desk'
  | 'chair'
  | 'bed'
  | 'door'
  | 'kitchen'
  | 'bathroom'
  | 'living'
  | 'custom';

export interface Zone {
  id: string;
  name: string;
  type: ZoneType;
  color: string;
  // Normalized coordinates (0.0 to 1.0) relative to camera frame
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SpatialPoint {
  timestamp: string;
  x: number; // Normalized 0-1
  y: number; // Normalized 0-1
  zone_id?: string | null;
  activity?: ActivityType;
}

export interface ActivityEvent {
  id: string;
  session_id: string;
  tracking_id: string;
  event_type: EventType;
  zone_id?: string | null;
  zone_name?: string | null;
  timestamp: string;
  duration?: number; // seconds
  confidence: number; // 0.0 - 1.0
  metadata?: Record<string, any>;
  acknowledged?: boolean;
}

export interface DailyStatistics {
  date: string; // YYYY-MM-DD
  totalOccupiedSeconds: number;
  sittingSeconds: number;
  standingSeconds: number;
  walkingSeconds: number;
  lyingSeconds: number;
  unknownSeconds: number;
  sessionsCount: number;
  longestSittingSeconds: number;
  averageSittingSeconds: number;
  firstPresenceTime: string | null;
  lastPresenceTime: string | null;
  fallsDetectedCount: number;
  inactivityAlertsCount: number;
  zoneUsageSeconds: Record<string, number>;
}

export interface RoomSettings {
  roomName: string;
  cameraIndex: number;
  fps: number;
  detectionConfidence: number;
  inactivityThresholdMinutes: number;
  fallSensitivity: number; // 0.1 - 1.0
  privacyMode: 'silhouette_only' | 'bounding_box_only' | 'wireframe';
  demoMode: boolean;
  activeSensor: 'camera' | 'mmwave' | 'simulation';
}

export interface RoomStatus {
  isOccupied: boolean;
  currentPersonId: string | null;
  currentActivity: ActivityType;
  currentZone: Zone | null;
  sessionDurationSeconds: number;
  activityDurationSeconds: number;
  lastUpdated: string;
  position: {
    x: number; // 0-1
    y: number; // 0-1
  } | null;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  velocity: number;
  inactivitySeconds: number;
  activeAlert: ActivityEvent | null;
}

export interface StandardObservation {
  timestamp: string;
  person_id: string;
  position: {
    x: number; // Normalized 0.0 - 1.0
    y: number; // Normalized 0.0 - 1.0
  };
  bbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  presence: boolean;
  activity: ActivityType;
  confidence: number;
  sensor_source?: string;
}

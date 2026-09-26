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

export interface CameraDevice {
  index: number;
  devicePath: string; // e.g. /dev/video0
  name: string; // e.g. "USB 2.0 HD Webcam", "Logitech C920"
  availableResolutions: string[];
  isAvailable: boolean;
}

export interface CameraConfig {
  cameraIndex: number;
  devicePath?: string;
  width: number;
  height: number;
  fps: number;
  rotation: 0 | 90 | 180 | 270;
  flipHorizontal: boolean;
  brightness: number; // -100 to 100
  contrast: number; // 0.5 to 2.0
  privacyMode: 'silhouette_only' | 'bounding_box_only' | 'wireframe_only' | 'full_vision';
  motionThreshold: number; // 200 - 5000
}

export interface RoomSettings {
  roomName: string;
  cameraIndex: number;
  fps: number;
  detectionConfidence: number;
  inactivityThresholdMinutes: number;
  fallSensitivity: number; // 0.1 - 1.0
  privacyMode: 'silhouette_only' | 'bounding_box_only' | 'wireframe' | 'wireframe_only' | 'full_vision';
  demoMode: boolean;
  activeSensor: 'camera' | 'mmwave' | 'simulation';
  cameraConfig?: CameraConfig;
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

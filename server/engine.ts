import {
  StandardObservation,
  ActivityEvent,
  Zone,
  ActivityType,
  SpatialPoint,
} from '../src/types/index.ts';
import { store } from './store.ts';

export class SpatialEngine {
  private lastObservation: StandardObservation | null = null;
  private currentSessionId: string | null = null;
  private sessionStartTime: number = 0;
  private currentActivityStartTime: number = Date.now();
  private lastActivity: ActivityType = 'UNKNOWN';
  private currentZoneId: string | null = null;
  private stationaryStartTime: number = Date.now();
  private lastPosition: { x: number; y: number } = { x: 0.5, y: 0.5 };
  private simulationInterval: NodeJS.Timeout | null = null;
  private simulationStep: number = 0;

  constructor() {
    this.startSimulationLoop();
    this.startStatsAccumulator();
  }

  public getZoneForPoint(x: number, y: number, zones: Zone[]): Zone | null {
    // Check zones in reverse so newer/more specific zones have priority
    for (let i = zones.length - 1; i >= 0; i--) {
      const z = zones[i];
      if (x >= z.x && x <= z.x + z.width && y >= z.y && y <= z.y + z.height) {
        return z;
      }
    }
    return null;
  }

  public processObservation(obs: StandardObservation): void {
    const now = Date.now();
    const isoNow = new Date(now).toISOString();
    const today = isoNow.split('T')[0];
    const settings = store.getSettings();
    const zones = store.getZones();
    const currentStatus = store.getStatus();

    // 1. Presence & Session Management
    if (obs.presence) {
      if (!this.currentSessionId || !currentStatus.isOccupied) {
        this.currentSessionId = `sess-${Date.now()}`;
        this.sessionStartTime = now;
        this.stationaryStartTime = now;
        this.lastPosition = { ...obs.position };

        const initialZone = this.getZoneForPoint(obs.position.x, obs.position.y, zones);
        this.currentZoneId = initialZone ? initialZone.id : null;

        store.addEvent({
          session_id: this.currentSessionId,
          tracking_id: obs.person_id,
          event_type: 'PERSON_ENTERED',
          zone_id: initialZone?.id || null,
          zone_name: initialZone?.name || null,
          timestamp: isoNow,
          confidence: obs.confidence,
          metadata: { initial_position: obs.position },
        });

        // Update first presence in stats
        const stats = store.getDailyStats(today);
        if (!stats.firstPresenceTime) {
          const hours = new Date(now).getHours().toString().padStart(2, '0');
          const mins = new Date(now).getMinutes().toString().padStart(2, '0');
          store.updateDailyStats(today, {
            firstPresenceTime: `${hours}:${mins}`,
            sessionsCount: stats.sessionsCount + 1,
          });
        }
      }
    } else {
      // Person left
      if (this.currentSessionId && currentStatus.isOccupied) {
        const sessionDuration = Math.round((now - this.sessionStartTime) / 1000);
        store.addEvent({
          session_id: this.currentSessionId,
          tracking_id: obs.person_id || 'person_001',
          event_type: 'PERSON_LEFT',
          zone_id: this.currentZoneId,
          timestamp: isoNow,
          duration: sessionDuration,
          confidence: 0.95,
        });

        this.currentSessionId = null;
        this.currentZoneId = null;
        this.lastActivity = 'UNKNOWN';

        const hours = new Date(now).getHours().toString().padStart(2, '0');
        const mins = new Date(now).getMinutes().toString().padStart(2, '0');
        store.updateDailyStats(today, { lastPresenceTime: `${hours}:${mins}` });

        store.setStatus({
          ...currentStatus,
          isOccupied: false,
          currentPersonId: null,
          currentActivity: 'UNKNOWN',
          currentZone: null,
          sessionDurationSeconds: 0,
          activityDurationSeconds: 0,
          lastUpdated: isoNow,
          position: null,
          bbox: null,
          velocity: 0,
        });
        return;
      }
    }

    if (!obs.presence) return;

    // 2. Zone Evaluation
    const detectedZone = this.getZoneForPoint(obs.position.x, obs.position.y, zones);
    const newZoneId = detectedZone ? detectedZone.id : null;

    if (newZoneId !== this.currentZoneId) {
      if (this.currentZoneId) {
        const prevZone = zones.find((z) => z.id === this.currentZoneId);
        store.addEvent({
          session_id: this.currentSessionId || 'sess-default',
          tracking_id: obs.person_id,
          event_type: 'ZONE_LEFT',
          zone_id: this.currentZoneId,
          zone_name: prevZone?.name || null,
          timestamp: isoNow,
          confidence: 0.92,
        });
      }

      if (newZoneId && detectedZone) {
        store.addEvent({
          session_id: this.currentSessionId || 'sess-default',
          tracking_id: obs.person_id,
          event_type: 'ZONE_ENTERED',
          zone_id: newZoneId,
          zone_name: detectedZone.name,
          timestamp: isoNow,
          confidence: 0.94,
        });
      }
      this.currentZoneId = newZoneId;
    }

    // 3. Movement velocity & Stationary check
    const dx = obs.position.x - this.lastPosition.x;
    const dy = obs.position.y - this.lastPosition.y;
    const distanceMoved = Math.sqrt(dx * dx + dy * dy);
    this.lastPosition = { ...obs.position };

    if (distanceMoved > 0.04) {
      // Moved significantly, reset inactivity timer
      this.stationaryStartTime = now;
    }

    const inactivitySeconds = Math.round((now - this.stationaryStartTime) / 1000);
    const inactivityThresholdSecs = settings.inactivityThresholdMinutes * 60;

    // Prolonged Inactivity Alert Check
    if (
      inactivitySeconds >= inactivityThresholdSecs &&
      !currentStatus.activeAlert &&
      inactivitySeconds < inactivityThresholdSecs + 15
    ) {
      const alertEvent = store.addEvent({
        session_id: this.currentSessionId || 'sess-default',
        tracking_id: obs.person_id,
        event_type: 'PROLONGED_INACTIVITY',
        zone_id: detectedZone?.id || null,
        zone_name: detectedZone?.name || null,
        timestamp: isoNow,
        duration: inactivitySeconds,
        confidence: 0.9,
        metadata: {
          inactivity_minutes: Math.round(inactivitySeconds / 60),
          position: obs.position,
        },
      });

      const stats = store.getDailyStats(today);
      store.updateDailyStats(today, {
        inactivityAlertsCount: stats.inactivityAlertsCount + 1,
      });

      currentStatus.activeAlert = alertEvent;
    }

    // 4. Activity State Transitions
    if (obs.activity !== this.lastActivity) {
      const previousActivityDuration = Math.round((now - this.currentActivityStartTime) / 1000);

      // Close previous activity event
      if (this.lastActivity === 'SITTING') {
        store.addEvent({
          session_id: this.currentSessionId || 'sess-default',
          tracking_id: obs.person_id,
          event_type: 'SITTING_ENDED',
          zone_id: detectedZone?.id || null,
          zone_name: detectedZone?.name || null,
          timestamp: isoNow,
          duration: previousActivityDuration,
          confidence: 0.91,
        });

        // Track longest sitting session
        const stats = store.getDailyStats(today);
        const longest = Math.max(stats.longestSittingSeconds, previousActivityDuration);
        store.updateDailyStats(today, { longestSittingSeconds: longest });
      } else if (this.lastActivity === 'WALKING') {
        store.addEvent({
          session_id: this.currentSessionId || 'sess-default',
          tracking_id: obs.person_id,
          event_type: 'WALKING_ENDED',
          zone_id: detectedZone?.id || null,
          zone_name: detectedZone?.name || null,
          timestamp: isoNow,
          duration: previousActivityDuration,
          confidence: 0.88,
        });
      }

      // Start new activity
      if (obs.activity === 'SITTING') {
        store.addEvent({
          session_id: this.currentSessionId || 'sess-default',
          tracking_id: obs.person_id,
          event_type: 'SITTING_STARTED',
          zone_id: detectedZone?.id || null,
          zone_name: detectedZone?.name || null,
          timestamp: isoNow,
          confidence: obs.confidence,
        });
      } else if (obs.activity === 'STANDING') {
        store.addEvent({
          session_id: this.currentSessionId || 'sess-default',
          tracking_id: obs.person_id,
          event_type: 'STANDING_STARTED',
          zone_id: detectedZone?.id || null,
          zone_name: detectedZone?.name || null,
          timestamp: isoNow,
          confidence: obs.confidence,
        });
      } else if (obs.activity === 'WALKING') {
        store.addEvent({
          session_id: this.currentSessionId || 'sess-default',
          tracking_id: obs.person_id,
          event_type: 'WALKING_STARTED',
          zone_id: detectedZone?.id || null,
          zone_name: detectedZone?.name || null,
          timestamp: isoNow,
          confidence: obs.confidence,
        });
      } else if (obs.activity === 'POSSIBLE_FALL') {
        const fallEvent = store.addEvent({
          session_id: this.currentSessionId || 'sess-default',
          tracking_id: obs.person_id,
          event_type: 'POTENTIAL_FALL',
          zone_id: detectedZone?.id || null,
          zone_name: detectedZone?.name || null,
          timestamp: isoNow,
          confidence: obs.confidence,
          metadata: {
            reason: 'Rapid aspect ratio distortion and vertical descent to floor plane',
            position: obs.position,
            posture: 'horizontal',
          },
        });

        const stats = store.getDailyStats(today);
        store.updateDailyStats(today, {
          fallsDetectedCount: stats.fallsDetectedCount + 1,
        });
        currentStatus.activeAlert = fallEvent;
      }

      this.lastActivity = obs.activity;
      this.currentActivityStartTime = now;
    }

    // 5. Store Spatial Heatmap Point
    store.addSpatialPoint({
      timestamp: isoNow,
      x: obs.position.x,
      y: obs.position.y,
      zone_id: detectedZone?.id || null,
      activity: obs.activity,
    });

    // 6. Update Real-time Status
    const sessionSeconds = Math.round((now - this.sessionStartTime) / 1000);
    const activitySeconds = Math.round((now - this.currentActivityStartTime) / 1000);

    store.setStatus({
      isOccupied: true,
      currentPersonId: obs.person_id,
      currentActivity: obs.activity,
      currentZone: detectedZone,
      sessionDurationSeconds: sessionSeconds,
      activityDurationSeconds: activitySeconds,
      lastUpdated: isoNow,
      position: obs.position,
      bbox: obs.bbox || {
        x: Math.max(0, obs.position.x - 0.08),
        y: Math.max(0, obs.position.y - 0.15),
        width: 0.16,
        height: 0.3,
      },
      velocity: distanceMoved,
      inactivitySeconds,
      activeAlert: currentStatus.activeAlert,
    });

    this.lastObservation = obs;
  }

  // Periodic accumulator for seconds spent in activity
  private startStatsAccumulator(): void {
    setInterval(() => {
      const status = store.getStatus();
      if (!status.isOccupied) return;

      const today = new Date().toISOString().split('T')[0];
      const stats = store.getDailyStats(today);

      const delta = 1; // 1 second
      let { sittingSeconds, standingSeconds, walkingSeconds, lyingSeconds, unknownSeconds } = stats;

      if (status.currentActivity === 'SITTING') sittingSeconds += delta;
      else if (status.currentActivity === 'STANDING') standingSeconds += delta;
      else if (status.currentActivity === 'WALKING') walkingSeconds += delta;
      else if (status.currentActivity === 'LYING' || status.currentActivity === 'POSSIBLE_FALL') lyingSeconds += delta;
      else unknownSeconds += delta;

      const totalOccupiedSeconds = stats.totalOccupiedSeconds + delta;

      // Update zone usage
      const zoneUsage = { ...stats.zoneUsageSeconds };
      if (status.currentZone) {
        zoneUsage[status.currentZone.id] = (zoneUsage[status.currentZone.id] || 0) + delta;
      }

      store.updateDailyStats(today, {
        totalOccupiedSeconds,
        sittingSeconds,
        standingSeconds,
        walkingSeconds,
        lyingSeconds,
        unknownSeconds,
        zoneUsageSeconds: zoneUsage,
      });
    }, 1000);
  }

  // Realistic Simulation loop for Demo Mode
  private startSimulationLoop(): void {
    const waypoints = [
      // Walk in from door
      { x: 0.1, y: 0.72, act: 'WALKING' as ActivityType, dur: 4 },
      { x: 0.28, y: 0.62, act: 'WALKING' as ActivityType, dur: 3 },
      { x: 0.45, y: 0.48, act: 'WALKING' as ActivityType, dur: 4 },
      // Reach desk, stand briefly
      { x: 0.68, y: 0.35, act: 'STANDING' as ActivityType, dur: 5 },
      // Sit down at desk chair
      { x: 0.72, y: 0.34, act: 'SITTING' as ActivityType, dur: 35 },
      // Stand up
      { x: 0.7, y: 0.36, act: 'STANDING' as ActivityType, dur: 4 },
      // Walk to rest lounge
      { x: 0.5, y: 0.3, act: 'WALKING' as ActivityType, dur: 4 },
      { x: 0.26, y: 0.24, act: 'SITTING' as ActivityType, dur: 18 },
      // Walk back towards desk
      { x: 0.42, y: 0.38, act: 'WALKING' as ActivityType, dur: 4 },
      { x: 0.71, y: 0.34, act: 'SITTING' as ActivityType, dur: 40 },
    ];

    let currentWaypointIndex = 4; // Start sitting at desk
    let waypointTimer = 0;

    this.simulationInterval = setInterval(() => {
      const settings = store.getSettings();
      if (!settings.demoMode && settings.activeSensor !== 'simulation') {
        return; // Don't run simulation if camera is live
      }

      const wp = waypoints[currentWaypointIndex];
      waypointTimer += 1;

      // Add minor organic jitter to coordinates
      const jitterX = (Math.random() - 0.5) * 0.012;
      const jitterY = (Math.random() - 0.5) * 0.012;

      const simObs: StandardObservation = {
        timestamp: new Date().toISOString(),
        person_id: 'person_001',
        position: {
          x: Math.min(0.95, Math.max(0.05, wp.x + jitterX)),
          y: Math.min(0.95, Math.max(0.05, wp.y + jitterY)),
        },
        bbox: {
          x: wp.x - 0.07,
          y: wp.y - (wp.act === 'SITTING' ? 0.12 : 0.18),
          width: wp.act === 'SITTING' ? 0.14 : 0.12,
          height: wp.act === 'SITTING' ? 0.22 : 0.36,
        },
        presence: true,
        activity: wp.act,
        confidence: 0.94,
        sensor_source: 'simulation_engine',
      };

      this.processObservation(simObs);

      if (waypointTimer >= wp.dur) {
        waypointTimer = 0;
        currentWaypointIndex = (currentWaypointIndex + 1) % waypoints.length;
      }
    }, 1000);
  }

  // Trigger manual simulation of a potential fall event
  public triggerSimulatedFall(): ActivityEvent {
    const now = new Date().toISOString();
    const zones = store.getZones();
    // Near center/lounge
    const fallObs: StandardObservation = {
      timestamp: now,
      person_id: 'person_001',
      position: { x: 0.38, y: 0.72 },
      bbox: { x: 0.26, y: 0.65, width: 0.24, height: 0.12 }, // Horizontal aspect ratio, low height
      presence: true,
      activity: 'POSSIBLE_FALL',
      confidence: 0.96,
      sensor_source: 'fall_detector_mvp',
    };
    this.processObservation(fallObs);
    return store.getStatus().activeAlert!;
  }
}

export const spatialEngine = new SpatialEngine();

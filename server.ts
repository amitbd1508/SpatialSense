import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { store } from './server/store.ts';
import { spatialEngine } from './server/engine.ts';
import { StandardObservation, Zone } from './src/types/index.ts';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

// ==========================================
// REST API ENDPOINTS
// ==========================================

// 1. Health & Status
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    platform: 'SpatialSense Edge Node',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime()),
  });
});

app.get('/api/status', (_req: Request, res: Response) => {
  const status = store.getStatus();
  const settings = store.getSettings();
  res.json({
    status,
    settings: {
      roomName: settings.roomName,
      demoMode: settings.demoMode,
      activeSensor: settings.activeSensor,
      privacyMode: settings.privacyMode,
    },
  });
});

app.get('/api/room', (_req: Request, res: Response) => {
  const settings = store.getSettings();
  const status = store.getStatus();
  const zones = store.getZones();
  res.json({
    name: settings.roomName,
    status,
    zoneCount: zones.length,
    activeSensor: settings.activeSensor,
  });
});

// 2. Zones CRUD
app.get('/api/zones', (_req: Request, res: Response) => {
  res.json(store.getZones());
});

app.post('/api/zones', (req: Request, res: Response) => {
  const { name, type, color, x, y, width, height } = req.body;
  if (!name || x === undefined || y === undefined || !width || !height) {
    res.status(400).json({ error: 'Missing required zone fields' });
    return;
  }
  const newZone = store.addZone({
    name,
    type: type || 'custom',
    color: color || '#3b82f6',
    x: Number(x),
    y: Number(y),
    width: Number(width),
    height: Number(height),
  });
  res.status(201).json(newZone);
});

app.put('/api/zones/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const updated = store.updateZone(id, req.body);
  if (!updated) {
    res.status(404).json({ error: 'Zone not found' });
    return;
  }
  res.json(updated);
});

app.delete('/api/zones/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const deleted = store.deleteZone(id);
  if (!deleted) {
    res.status(404).json({ error: 'Zone not found' });
    return;
  }
  res.json({ success: true, id });
});

// 3. Activity & Statistics
app.get('/api/activity/today', (_req: Request, res: Response) => {
  const today = new Date().toISOString().split('T')[0];
  const stats = store.getDailyStats(today);
  res.json(stats);
});

app.get('/api/activity/history', (_req: Request, res: Response) => {
  res.json(store.getHistory());
});

app.get('/api/statistics', (_req: Request, res: Response) => {
  const today = new Date().toISOString().split('T')[0];
  const stats = store.getDailyStats(today);
  const status = store.getStatus();
  res.json({
    today,
    occupancy: {
      totalSeconds: stats.totalOccupiedSeconds,
      firstPresence: stats.firstPresenceTime,
      lastPresence: stats.lastPresenceTime,
      sessionsCount: stats.sessionsCount,
      currentSessionSeconds: status.sessionDurationSeconds,
      isCurrentlyOccupied: status.isOccupied,
    },
    posture: {
      sittingSeconds: stats.sittingSeconds,
      standingSeconds: stats.standingSeconds,
      walkingSeconds: stats.walkingSeconds,
      lyingSeconds: stats.lyingSeconds,
      longestSittingSeconds: stats.longestSittingSeconds,
      averageSittingSeconds: stats.averageSittingSeconds,
    },
    safety: {
      fallsDetected: stats.fallsDetectedCount,
      inactivityAlerts: stats.inactivityAlertsCount,
    },
    zoneBreakdown: stats.zoneUsageSeconds,
  });
});

// 4. Events & Timeline
app.get('/api/events', (req: Request, res: Response) => {
  const limit = parseInt((req.query.limit as string) || '100', 10);
  res.json(store.getEvents(limit));
});

app.post('/api/events/:id/acknowledge', (req: Request, res: Response) => {
  const { id } = req.params;
  const success = store.acknowledgeEvent(id);
  if (!success) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }
  res.json({ success: true, id, acknowledgedAt: new Date().toISOString() });
});

// 5. Heatmap & Spatial Trail
app.get('/api/heatmap', (req: Request, res: Response) => {
  const limit = parseInt((req.query.limit as string) || '1500', 10);
  const points = store.getSpatialPoints(limit);
  res.json({
    points,
    count: points.length,
    zones: store.getZones(),
  });
});

// 6. Live Feed & Ingestion (Privacy-Preserving Observations)
app.get('/api/live', (_req: Request, res: Response) => {
  const status = store.getStatus();
  const zones = store.getZones();
  res.json({
    status,
    zones,
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/observations', (req: Request, res: Response) => {
  const obs = req.body as StandardObservation;
  if (!obs || obs.presence === undefined || !obs.position) {
    res.status(400).json({ error: 'Invalid observation payload' });
    return;
  }
  spatialEngine.processObservation(obs);
  res.json({ success: true, processed_at: new Date().toISOString() });
});

// 7. Settings
app.get('/api/settings', (_req: Request, res: Response) => {
  res.json(store.getSettings());
});

app.put('/api/settings', (req: Request, res: Response) => {
  const updated = store.updateSettings(req.body);
  res.json(updated);
});

// 8. Simulation Actions
app.post('/api/simulate/fall', (_req: Request, res: Response) => {
  const alert = spatialEngine.triggerSimulatedFall();
  res.json({
    success: true,
    message: 'Potential fall simulated',
    alert,
  });
});

// 9. Privacy-Safe Event Summary via Gemini AI (Metadata only, NO video)
app.post('/api/ai/summary', async (_req: Request, res: Response) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(503).json({
      error: 'GEMINI_API_KEY is not configured. Provide it in .env to enable AI summaries.',
    });
    return;
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const stats = store.getDailyStats(today);
    const recentEvents = store.getEvents(25);
    const zones = store.getZones();

    const sanitizedEvents = recentEvents.map((e) => ({
      time: e.timestamp.split('T')[1]?.substring(0, 5) || e.timestamp,
      event: e.event_type,
      zone: e.zone_name || 'Open Area',
      duration_sec: e.duration || 0,
      confidence: Math.round(e.confidence * 100) + '%',
    }));

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `You are SpatialSense, a privacy-first indoor spatial intelligence system.
Analyze the following ANONYMOUS spatial activity metadata for a room (NO video or facial data exists):

Room Statistics for Today (${today}):
- Total Occupancy: ${Math.round(stats.totalOccupiedSeconds / 60)} minutes
- Sitting Duration: ${Math.round(stats.sittingSeconds / 60)} minutes
- Standing Duration: ${Math.round(stats.standingSeconds / 60)} minutes
- Walking Duration: ${Math.round(stats.walkingSeconds / 60)} minutes
- Longest Sitting Session: ${Math.round(stats.longestSittingSeconds / 60)} minutes
- Safety Events: ${stats.fallsDetectedCount} potential falls, ${stats.inactivityAlertsCount} prolonged inactivity alerts

Recent Structured Event Stream:
${JSON.stringify(sanitizedEvents, null, 2)}

Provide a concise, professional 3-paragraph summary:
1. Executive Occupancy & Flow: How the room was used today, main zones, and transition patterns.
2. Ergonomic & Wellness Insights: Posture distribution (sitting vs standing vs moving) and longest continuous stationary intervals (use neutral, respectful language; no medical diagnosis or employee ranking).
3. Safety & Spatial Utilization Observations: Any potential fall notices or prolonged inactivity, plus recommended zone layout adjustments if any.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    res.json({
      summary: response.text,
      generated_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error generating AI summary:', error);
    res.status(500).json({ error: error.message || 'Failed to generate AI summary' });
  }
});

// ==========================================
// VITE OR STATIC SERVING
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SpatialSense platform running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

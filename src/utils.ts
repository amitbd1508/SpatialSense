export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds <= 0) return '0m';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
  }
  if (mins > 0) {
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  }
  return `${secs}s`;
}

export function formatTimeOnly(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return isoString;
  }
}

export function formatDateLabel(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return isoString;
  }
}

export const ZONE_PRESET_COLORS: Record<string, string> = {
  desk: '#10b981',     // Emerald
  chair: '#8b5cf6',    // Purple
  bed: '#f59e0b',      // Amber
  door: '#0284c7',     // Sky
  kitchen: '#ec4899',  // Pink
  bathroom: '#06b6d4', // Cyan
  living: '#6366f1',   // Indigo
  custom: '#64748b',   // Slate
};

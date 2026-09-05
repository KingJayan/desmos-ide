const MINUTE = 60_000;
const UNITS: readonly [number, string][] = [
  [365 * 24 * 60 * MINUTE, 'y'], [30 * 24 * 60 * MINUTE, 'mo'],
  [24 * 60 * MINUTE, 'd'], [60 * MINUTE, 'h'], [MINUTE, 'm'],
];

export function relativeTime(then: number, now: number = Date.now()): string {
  if (!Number.isFinite(then)) return 'unknown';
  const gap = Math.max(0, now - then);
  for (const [size, unit] of UNITS) {
    if (gap >= size) return `${Math.floor(gap / size)}${unit} ago`;
  }
  return 'just now';
}

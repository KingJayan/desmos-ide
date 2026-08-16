/** the speed multipliers the bar offers */
export const SPEEDS = [0.25, 0.5, 1, 2, 4] as const;

export type Speed = (typeof SPEEDS)[number];

const MIN_PERIOD = 50;

export function periodFor(basePeriod: number, speed: number): number {
  if (!Number.isFinite(basePeriod) || basePeriod <= 0 || speed <= 0) return MIN_PERIOD;
  return Math.max(MIN_PERIOD, Math.round(basePeriod / speed));
}

/** where the scrub handle sits, 0–1, for a clock value */
export function valueToScrub(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || max === min) return 0;
  return clamp01((value - min) / (max - min));
}

/** the clock value for a scrub handle at 0–1 */
export function scrubToValue(pos: number, min: number, max: number): number {
  return min + clamp01(pos) * (max - min);
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function formatClockValue(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/** the speed label, so 0.25 reads as "0.25x" and 1 as "1x" */
export function formatSpeed(speed: number): string {
  return `${speed}x`;
}

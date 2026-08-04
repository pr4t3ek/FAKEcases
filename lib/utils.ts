import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a large integer using the Indian numbering system (lakh/crore). */
export function formatIndianNumber(n: number): string {
  if (!isFinite(n)) return "—";
  const rounded = Math.round(n);
  const isNegative = rounded < 0;
  const s = Math.abs(rounded).toString();
  let out: string;
  if (s.length <= 3) {
    out = s;
  } else {
    const last3 = s.slice(-3);
    const rest = s.slice(0, -3);
    out = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
  }
  return (isNegative ? "-" : "") + out;
}

/** Human "crore / lakh" label for very large numbers. */
export function toIndianWords(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e7) return `${(n / 1e7).toFixed(2)} cr`;
  if (abs >= 1e5) return `${(n / 1e5).toFixed(2)} L`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

export function formatINR(n: number): string {
  return `₹${formatIndianNumber(n)}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Exhaustiveness check for a discriminated union.
 *
 * Put it in the default arm of a `switch` and TypeScript fails the build if a
 * variant is ever added without being handled — which beats the alternative of
 * a silently skipped case, especially where the arms assign rather than return.
 */
export function assertNever(value: never, context = "value"): never {
  throw new Error(`Unhandled ${context}: ${JSON.stringify(value)}`);
}

/** Deterministic pseudo-random in [0,1) from a string seed (for mock/offline determinism). */
export function seededRandom(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // xorshift a bit for spread
  h ^= h << 13;
  h ^= h >>> 17;
  h ^= h << 5;
  return ((h >>> 0) % 100000) / 100000;
}

export function pick<T>(arr: T[], seed: string): T {
  return arr[Math.floor(seededRandom(seed) * arr.length) % arr.length];
}

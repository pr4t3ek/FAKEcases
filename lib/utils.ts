import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number using the Indian numbering system (lakh/crore).
 *
 * Integers by default, which is what every display caller wants — a population
 * of "1,42,86,000.4" helps nobody. `maxDecimals` is for the one caller where
 * rounding is a lie rather than a tidy-up: the calculator, where `44 / 8` has to
 * read as 5.5 and not as 6. Trailing zeros are dropped, so an exact result still
 * prints exactly.
 */
export function formatIndianNumber(n: number, maxDecimals = 0): string {
  if (!isFinite(n)) return "—";
  const fixed = Math.abs(n).toFixed(maxDecimals);
  const [whole, fraction = ""] = fixed.split(".");
  const isNegative = n < 0 && Number(fixed) !== 0;

  let out: string;
  if (whole.length <= 3) {
    out = whole;
  } else {
    const last3 = whole.slice(-3);
    const rest = whole.slice(0, -3);
    out = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
  }

  const trimmed = fraction.replace(/0+$/, "");
  return (isNegative ? "-" : "") + out + (trimmed ? `.${trimmed}` : "");
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

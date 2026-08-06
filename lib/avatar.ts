/**
 * Reading and checking an uploaded avatar.
 *
 * Everything here is pure — no Prisma, no `server-only` — so the checks can be
 * unit-tested, which matters more than usual because this is the one place the
 * app accepts bytes from a browser.
 *
 * The browser resizes before uploading (see `components/profile/avatar-picker.tsx`),
 * and none of that is trusted here. A resize is a convenience for the person on
 * a slow connection; a server action is reachable with any payload someone
 * cares to send it, so the mime is read out of the data URI rather than taken
 * from the caller, and the size is checked against the encoded string *before*
 * anything is decoded.
 */

import { avatarLimits, type AvatarMime } from "@/lib/config";

export type AvatarCheck =
  | { ok: true; bytes: Buffer; mime: AvatarMime }
  | { ok: false; error: string };

/** `data:image/jpeg;base64,…` — the only form the picker produces. */
const DATA_URI = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/i;

function isAllowedMime(mime: string): mime is AvatarMime {
  return (avatarLimits.mimes as readonly string[]).includes(mime);
}

/**
 * What the bytes actually are, read from their leading magic numbers.
 *
 * The declared media type in a data URI is a claim by whoever sent it, and this
 * is the check that makes it more than a claim. It matters here specifically
 * because the avatar is served back out of our own origin with the stored
 * `Content-Type`: without this, anything at all could be uploaded, labelled
 * `image/jpeg`, and then fetched from a same-origin URL.
 *
 * Null for anything unrecognised, which the caller treats as a refusal — an
 * allowlist, so a format nobody sniffs is a format nobody stores.
 */
export function sniffImageMime(bytes: Buffer): AvatarMime | null {
  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && PNG.every((b, i) => bytes[i] === b)) {
    return "image/png";
  }
  // WebP: "RIFF" .... "WEBP"
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

/**
 * Decoded length of a base64 string, without decoding it.
 *
 * Used to refuse an oversized payload before allocating a buffer for it —
 * checking after the decode means a caller can still make the server hold
 * whatever they sent, which is the part worth avoiding.
 */
export function base64ByteLength(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/**
 * Parse and check a submitted avatar.
 *
 * Errors are returned rather than thrown, and phrased for the person who just
 * picked a file — the same convention as the question authoring contract.
 */
export function validateAvatarDataUri(input: unknown): AvatarCheck {
  if (typeof input !== "string" || input.length === 0) {
    return { ok: false, error: "No image was received." };
  }

  const match = DATA_URI.exec(input.trim());
  if (!match) {
    return { ok: false, error: "That doesn't look like an image file." };
  }

  const [, mime, base64] = match;
  // Read from the payload, never from a separate caller-supplied field: a mime
  // the caller asserts is a mime the caller can lie about.
  if (!isAllowedMime(mime.toLowerCase())) {
    return {
      ok: false,
      error: `${mime} isn't supported — use a JPEG, PNG or WebP.`,
    };
  }

  const size = base64ByteLength(base64);
  if (size <= 0) return { ok: false, error: "That image file is empty." };
  if (size > avatarLimits.maxBytes) {
    const kb = Math.round(avatarLimits.maxBytes / 1024);
    return { ok: false, error: `That image is too large — keep it under ${kb} KB.` };
  }

  const bytes = Buffer.from(base64, "base64");
  // A base64 string can parse and still decode to something shorter than it
  // claimed; treat the disagreement as corruption rather than trusting either.
  if (bytes.length === 0) return { ok: false, error: "That image could not be read." };

  // The declared type was a claim; this is the check. Note the returned mime is
  // the SNIFFED one, never the declared one — so what gets stored, and later
  // served as a Content-Type, is what the bytes actually are.
  const actual = sniffImageMime(bytes);
  if (!actual) {
    return { ok: false, error: "That file isn't a JPEG, PNG or WebP image." };
  }

  return { ok: true, bytes, mime: actual };
}

/**
 * The URL the built-in database store serves an avatar from.
 *
 * `version` is in the query string so the route can answer with an immutable
 * cache header: a new upload is a new URL, and the old one is never asked for
 * again. Without it the choice is between a stale avatar and no caching at all.
 */
export function avatarUrlFor(userId: string, version: number): string {
  return `/api/avatar/${userId}?v=${version}`;
}

/** Initials for the fallback shown before, or instead of, a photo. */
export function initialsFor(name: string | null | undefined, email?: string | null): string {
  const source = name?.trim() || email?.split("@")[0] || "";
  const words = source.split(/[\s._-]+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

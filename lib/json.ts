/**
 * Reading the JSON-in-String columns.
 *
 * SQLite has no JSON type, so structured columns are stored as text (see
 * `prisma/schema.prisma`). Those columns are hand-authored in the seed and the
 * admin panel, which means malformed content is a live possibility — and a
 * report or a practice screen that throws on it is a worse outcome than one that
 * treats the field as absent.
 */

/** Parse a JSON column, treating blank or malformed content as absent. */
export function parseJson<T>(raw: string | null | undefined): T | null {
  if (!raw?.trim()) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Parse a JSON array column, falling back to an empty array. */
export function parseJsonArray<T>(raw: string | null | undefined): T[] {
  const parsed = parseJson<T[]>(raw);
  return Array.isArray(parsed) ? parsed : [];
}

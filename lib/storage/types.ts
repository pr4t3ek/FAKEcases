/**
 * Where a user's avatar bytes go.
 *
 * The seam sits at "keep these bytes and give me back a URL" rather than at any
 * one backend's shape, because the two kinds of provider work very differently:
 * the built-in one writes a row and serves it back through a route handler,
 * while an object store uploads and hands over a CDN address it already knows.
 * Anything narrower — a `path`, a `bucket`, a `Response` — would bake one of
 * those in and have to be rewritten to add the other.
 *
 * A URL is what makes the swap free. `User.image` stores whatever comes back,
 * every render is an `<img src>`, and no call site can tell which provider
 * answered.
 *
 * This module imports no provider and no Prisma, so the interface can be read
 * without pulling a database client into the graph.
 */

import type { AvatarMime } from "@/lib/config";

export interface AvatarStore {
  /** Provider name, for diagnostics. */
  readonly name: string;

  /**
   * Persist an avatar and return the URL to serve it from.
   *
   * The bytes have already been validated (`lib/avatar.ts`); a provider is not
   * expected to re-check the mime or the size. Overwrites any existing avatar
   * for the same user — a person has one.
   *
   * The returned URL must change whenever the bytes do, or a cached copy will
   * outlive the upload that replaced it.
   */
  put(userId: string, bytes: Buffer, mime: AvatarMime): Promise<string>;

  /**
   * Drop a user's avatar. Safe to call when there isn't one — removing an
   * absent avatar is the state the caller wanted either way.
   */
  remove(userId: string): Promise<void>;
}

/**
 * Picking the avatar store, the same way `getAdapter()` picks an LLM and
 * `getRecogniser()` picks a transcriber.
 *
 * One provider today, and the switch is still the point: it is the line that
 * says where the second one goes, and it means no call site ever learns which
 * one answered.
 *
 * Adding an object store means:
 *   - `lib/storage/<name>.ts` exporting an object that implements `AvatarStore`,
 *     whose `put()` returns the public URL of the uploaded object;
 *   - its credentials read server-side in `lib/config/storage.ts`, never
 *     `NEXT_PUBLIC_` — a key inlined into the client bundle is a key given away;
 *   - the name added to `AVATAR_STORES` and a `case` here;
 *   - nothing else. `User.image` already holds a URL, so the profile page, the
 *     account menu and the header need no change at all.
 *
 * `app/api/avatar/[userId]/route.ts` belongs to the `db` provider specifically;
 * an external store serves its own bytes and leaves that route unused.
 */

import { storageConfig } from "@/lib/config";
import { dbAvatarStore } from "./db";
import type { AvatarStore } from "./types";

export type { AvatarStore } from "./types";

export function getAvatarStore(): AvatarStore {
  switch (storageConfig.avatarStore) {
    case "db":
    default:
      return dbAvatarStore;
  }
}

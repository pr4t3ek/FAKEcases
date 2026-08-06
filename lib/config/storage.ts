/**
 * Where uploaded avatars are kept.
 *
 * Its own file, and its own env var, because this is the one place the app
 * stores a *user's* bytes rather than reading someone else's service. The
 * default keeps the zero-key promise: the image goes in the database the app
 * already has, so avatars work on a clone with no configuration, and on Vercel,
 * whose filesystem is read-only.
 *
 * Server-side, not `NEXT_PUBLIC_`: the browser never picks the store. It hands
 * a data URI to a server action and gets a URL back, which is exactly the seam
 * that lets an external provider land later without a single call site
 * changing. See `lib/storage/index.ts`.
 */

export const AVATAR_STORES = ["db"] as const;
export type AvatarStoreName = (typeof AVATAR_STORES)[number];

function isStore(value: string): value is AvatarStoreName {
  return (AVATAR_STORES as readonly string[]).includes(value);
}

const requested = process.env.AVATAR_STORE ?? "";

export const storageConfig = {
  /**
   * Falls back to `db` rather than throwing on an unknown name. A typo in a
   * deployment's env should cost a working avatar upload, not the whole app —
   * and the same posture as `detectProvider()` in `./env.ts`.
   */
  avatarStore: isStore(requested) ? requested : ("db" as AvatarStoreName),
};

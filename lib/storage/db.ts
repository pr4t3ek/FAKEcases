/**
 * Avatars in the database the app already has.
 *
 * The zero-key default. It needs no bucket, no credentials and no writable
 * filesystem, which is what lets avatars work on a fresh clone and on Vercel
 * alike — the same stance as the mock interviewer and the browser recogniser.
 *
 * The cost is honest and worth naming: image bytes in a row are bytes the
 * database backs up and the query planner steps over. It is the right trade at
 * demo scale and the wrong one at a million users, which is exactly why it sits
 * behind `AvatarStore` rather than being called directly.
 *
 * Bytes live on `Profile`, never on `User`, and are read only by
 * `app/api/avatar/[userId]/route.ts`. `getSessionUser()` returns the `User` row
 * on every page in the app; an avatar there would ride along with it.
 */

import { db } from "@/lib/db";
import { avatarUrlFor } from "@/lib/avatar";
import type { AvatarMime } from "@/lib/config";
import type { AvatarStore } from "./types";

export const dbAvatarStore: AvatarStore = {
  name: "db",

  async put(userId: string, bytes: Buffer, mime: AvatarMime): Promise<string> {
    const data = bytes.toString("base64");

    // The version is bumped rather than set, so the served URL changes on every
    // upload and the immutable cache header on the route stays truthful.
    const profile = await db.profile.upsert({
      where: { userId },
      update: { avatarData: data, avatarMime: mime, avatarVersion: { increment: 1 } },
      create: { userId, avatarData: data, avatarMime: mime, avatarVersion: 1 },
      select: { avatarVersion: true },
    });

    return avatarUrlFor(userId, profile.avatarVersion);
  },

  async remove(userId: string): Promise<void> {
    // `updateMany` rather than `update`: a user with no profile row yet is not
    // an error here, it is someone who never had an avatar to remove.
    await db.profile.updateMany({
      where: { userId },
      data: { avatarData: null, avatarMime: null },
    });
  },
};

/**
 * Serving an avatar stored by the built-in database store.
 *
 * This route belongs to that provider specifically. An external object store
 * serves its own bytes and puts its own URL on `User.image`, so nothing ever
 * reaches here — which is why the store is asked whether it serves reads rather
 * than the route assuming it does.
 *
 * Not authenticated, and worth being explicit about: a profile photo is served
 * to anyone holding the URL. Checking the session here would mean a database
 * lookup on every image render and no caching at all, which is a poor trade for
 * a picture the owner chose to put on a profile. It is listed under the
 * README's known limitations rather than left unsaid.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { storageConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  // Only the `db` store puts bytes in this table; under any other provider this
  // route is dead and should say so rather than 500 on a missing column.
  if (storageConfig.avatarStore !== "db") {
    return new NextResponse("Not found", { status: 404 });
  }

  const { userId } = await params;
  const profile = await db.profile.findUnique({
    where: { userId },
    select: { avatarData: true, avatarMime: true },
  });

  if (!profile?.avatarData || !profile.avatarMime) {
    return new NextResponse("Not found", { status: 404 });
  }

  const bytes = Buffer.from(profile.avatarData, "base64");

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": profile.avatarMime,
      "Content-Length": String(bytes.length),
      // Safe to call immutable because the URL carries `?v=<avatarVersion>`,
      // which the store increments on every upload — a replaced photo is a new
      // URL, so a cached copy is never the wrong one.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

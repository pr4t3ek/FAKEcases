import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canHostRooms, roomKindFor } from "@/lib/types";
import { loadPracticeRoster, loadRoom, loadRoster } from "@/lib/rooms";

export const dynamic = "force-dynamic";

/**
 * The host console's poll.
 *
 * A read-only JSON endpoint, which is an honest description of what a poll is —
 * and the reason it is not a Server Action. Actions are this repo's *mutation*
 * seam; polling one would conflate read with write, serialise through the action
 * queue, and POST something with no cache semantics every five seconds.
 *
 * **Authorised on every request**, unlike `/api/avatar/[userId]`, which is
 * deliberately open. That one serves a photo its owner put on a public profile;
 * this one serves a roster of names, email addresses and scores, so obscurity
 * is not an acceptable substitute for a check.
 *
 * A caller who is not the host gets 404 rather than 403 — a 403 would confirm
 * that a room with this code exists, which is the same oracle `joinRoom`'s
 * single refusal message exists to close.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;

  const user = await getSessionUser();
  if (!user || !canHostRooms(user.role)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const room = await loadRoom(code);
  if (!room || (room.hostId !== user.id && user.role !== "admin")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Which roster, decided by the room's question exactly as the console decides
  // which board to render. The two cannot disagree, because both ask
  // `roomKindFor` rather than each keeping its own idea of what the room is.
  const roster =
    roomKindFor(room.question.type) === "simulation"
      ? await loadRoster(room.id)
      : await loadPracticeRoster(room.id);

  return NextResponse.json({
    // Sent alongside the roster so the console can notice a room closed from
    // another tab without a second request.
    status: room.status,
    roster,
  });
}

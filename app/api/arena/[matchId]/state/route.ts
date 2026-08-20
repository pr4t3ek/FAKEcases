import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { canPlayArena } from "@/lib/arena/access";
import { journalOf, loadMatch, resolveIfDue, stagedFor } from "@/lib/arena";

/**
 * A tiny poll, so a multiplayer board notices the other seats.
 *
 * Copied in shape from `app/api/host/[code]/roster/route.ts` rather than
 * reaching for websockets: the roster board has been polling every five seconds
 * in front of a live class for a while, and one transport in the app is worth
 * more than the latency a second one would save.
 *
 * It returns COUNTERS, not the board. The client compares them and refetches the
 * page when something moved, so this route never becomes a second, subtly
 * different copy of the payload builder.
 *
 * It also calls `resolveIfDue`, which is what makes the round timer real: a
 * board left open is the thing that notices the clock ran out.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const { matchId } = await params;

  const user = await getSessionUser();
  if (!canPlayArena(user)) {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  await resolveIfDue(matchId);

  const match = await loadMatch(matchId);
  if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!match.seats.some((s) => s.userId === user!.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const round = journalOf(match)?.entries.length ?? 0;
  const staged = stagedFor(match, round);

  return NextResponse.json({
    status: match.status,
    round,
    seated: match.seats.filter((s) => s.userId !== null).length,
    committed: Object.keys(staged).length,
    roundEndsAt: match.roundEndsAt ? match.roundEndsAt.getTime() : null,
  });
}

import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { ARENA_WALL, canPlayArena } from "@/lib/arena/access";
import { journalOf, loadMatch, resolveIfDue, stagedFor } from "@/lib/arena";
import { buildBoard, buildDebrief } from "@/lib/arena/payload";
import { replayMatch } from "@/lib/arena/run";
import { scoreMatch } from "@/lib/arena/score";
import { specialise } from "@/lib/arena/setup";
import { toSeatViews } from "@/lib/arena/setup";
import { getPersona } from "@/lib/arena/personas";
import { ArenaBoard } from "@/components/arena/arena-board";
import { ArenaDebrief } from "@/components/arena/arena-debrief";

export const dynamic = "force-dynamic";

/**
 * One match.
 *
 * The whole market is REBUILT here from the seed and the journal on every
 * request — the rule the config-driven runs already follow. It is eight ticks
 * of arithmetic and no I/O, and it is what makes the match a player resumes
 * provably the match they left rather than a snapshot an older build wrote.
 *
 * Loading this page is also what moves the world on. `resolveIfDue` is called
 * before anything is read, so a round whose timer expired while nobody was
 * looking resolves the moment somebody looks — no cron, nothing to backfill.
 */
export default async function ArenaMatchPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;

  const user = await getSessionUser();
  if (!canPlayArena(user)) redirect(ARENA_WALL);

  await resolveIfDue(matchId);

  const match = await loadMatch(matchId);
  if (!match) redirect("/arena");

  const seatSpecs = match.seats.map((s) => ({
    seatIndex: s.seatIndex,
    userId: s.userId,
    personaId: s.personaId,
  }));

  const config = specialise({
    gameSlug: match.configSlug,
    seed: match.seed,
    seats: seatSpecs,
  });
  if (!config) redirect("/arena");

  const state = replayMatch({ config, seed: match.seed, journal: journalOf(match) });

  const names: Record<number, string> = {};
  for (const s of match.seats) {
    names[s.seatIndex] =
      s.displayName || getPersona(s.personaId)?.label || `Firm ${s.seatIndex + 1}`;
  }
  const seats = toSeatViews(seatSpecs, names);
  const mySeat = match.seats.find((s) => s.userId === user!.id)?.seatIndex ?? null;

  if (match.status === "finished") {
    const { scores, placings, distribution } = scoreMatch({
      config,
      state: state.ctx.state,
      seed: match.seed,
      humanSeats: match.seats.filter((s) => s.userId !== null).map((s) => s.seatIndex),
    });

    return (
      <ArenaDebrief
        data={buildDebrief({
          matchId,
          config,
          state,
          seats,
          yourSeat: mySeat,
          scores: scores.map((s) => ({
            seatIndex: s.seatIndex,
            overall: s.overall,
            band: s.band,
            npv: s.npv,
            scores: s.scores,
            kpis: s.kpis.map((k) => ({
              key: k.key,
              label: k.label,
              unit: k.unit,
              value: k.value,
              goodDirection: k.goodDirection,
            })),
          })),
          placings,
          reference: {
            p10: distribution.p10,
            median: distribution.median,
            p90: distribution.p90,
          },
        })}
      />
    );
  }

  const staged = stagedFor(match, state.round);
  const waitingOn = match.seats
    .filter((s) => s.userId !== null && staged[s.seatIndex] === undefined)
    .map((s) => names[s.seatIndex]);

  return (
    <ArenaBoard
      data={buildBoard({
        matchId,
        config,
        state,
        seats,
        yourSeat: mySeat,
        mode: match.mode,
        status: match.status,
        code: match.code,
        isHost: match.hostId === user!.id,
        committed: mySeat !== null && staged[mySeat] !== undefined,
        waitingOn,
        roundEndsAt: match.roundEndsAt,
      })}
    />
  );
}

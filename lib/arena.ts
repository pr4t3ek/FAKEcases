/**
 * Data access for arena matches — the counterpart to `lib/rooms.ts`.
 *
 * Everything that touches Prisma for a match goes through here, so the rules
 * under `lib/arena/` stay pure and testable and the server actions stay thin.
 * That split is the reason `lib/arena/run.ts` can be exercised by the sweep
 * 3,000 times without a database anywhere near it.
 *
 * Note what is absent: nothing in this file writes an `Attempt`, an
 * `Evaluation` or a `LeaderboardEntry`. An arena result is scored on a rubric
 * of its own and must not move interview readiness or percentile rank, and the
 * way that is guaranteed is that the rows `updateProgress` and `recomputeRank`
 * read do not exist on this path at all.
 */

// No `import "server-only"`, matching `lib/daily-unlock.ts` rather than
// `lib/auth.ts`: the marker is unresolvable under Vitest, and the round-
// resolution rules in here are precisely the part that has to be tested — AI
// backfill, the timer auto-commit, and a double resolve being a no-op. The
// fence would buy little anyway, since importing this from a client component
// would fail on the Prisma import a line below.

import { db } from "@/lib/db";
import { generateRoomCode } from "@/lib/rooms/code";
import { parseJournal, serialiseJournal, type RunJournal } from "@/lib/sim/engine/journal";
import { dealPersonas } from "@/lib/arena/personas";
import { planRound } from "@/lib/arena/rounds";
import { carryForward, namespaceDecision, replayMatch, stepMatch } from "@/lib/arena/run";
import { scoreMatch } from "@/lib/arena/score";
import { specialise, type MatchConfig } from "@/lib/arena/setup";
import { ARENA_SEATS, ROUND_SECONDS, type ArenaMode } from "@/lib/arena/types";

/** A match with its seats and this round's staged decisions. */
export async function loadMatch(matchId: string) {
  return db.arenaMatch.findUnique({
    where: { id: matchId },
    include: {
      seats: { orderBy: { seatIndex: "asc" }, include: { user: { select: { id: true, name: true } } } },
      decisions: true,
    },
  });
}

export type LoadedMatch = NonNullable<Awaited<ReturnType<typeof loadMatch>>>;

export async function loadMatchByCode(code: string) {
  const match = await db.arenaMatch.findUnique({ where: { code }, select: { id: true } });
  return match ? loadMatch(match.id) : null;
}

/**
 * Open a match, retrying past a code collision.
 *
 * The same shape as `createRoomRow`: the unique constraint is the control and
 * this loop is the courtesy, so a one-in-a-billion collision stays a fact
 * rather than an assumption.
 *
 * Every seat is created up front, including the ones nobody is sitting in. A
 * match therefore always has four firms from the moment it exists, which is
 * what makes "the game starts whether or not anybody joins" true in the schema
 * rather than in a code path somebody has to remember.
 */
export async function createMatchRow(args: {
  hostId: string;
  configSlug: string;
  mode: ArenaMode;
  hostName: string;
}): Promise<LoadedMatch | null> {
  const seed = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const personas = dealPersonas(seed, ARENA_SEATS);
  const solo = args.mode === "solo";

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = solo ? null : generateRoomCode();
    try {
      const match = await db.arenaMatch.create({
        data: {
          configSlug: args.configSlug,
          mode: args.mode,
          // A solo match has nobody to wait for, so it opens already running.
          // A lobby with one seat in it is a screen that exists to be clicked
          // through.
          status: solo ? "running" : "lobby",
          code,
          hostId: args.hostId,
          seed,
          roundEndsAt: solo ? null : null,
          journalJson: "",
          seats: {
            create: Array.from({ length: ARENA_SEATS }, (_, seatIndex) => ({
              seatIndex,
              // Seat 0 is the host. Every other seat starts as the house and is
              // taken over by a person only if one joins.
              userId: seatIndex === 0 ? args.hostId : null,
              personaId: personas[seatIndex],
              displayName: seatIndex === 0 ? args.hostName : "",
            })),
          },
        },
      });
      return loadMatch(match.id);
    } catch (error) {
      if ((error as { code?: string })?.code === "P2002") continue;
      throw error;
    }
  }
  return null;
}

/** Take the lowest free seat, or return the one this person already holds. */
export async function takeSeat(args: {
  matchId: string;
  userId: string;
  displayName: string;
}): Promise<number | null> {
  const match = await loadMatch(args.matchId);
  if (!match) return null;

  const mine = match.seats.find((s) => s.userId === args.userId);
  if (mine) return mine.seatIndex;
  if (match.status !== "lobby") return null;

  const free = match.seats.find((s) => s.userId === null);
  if (!free) return null;

  try {
    await db.arenaSeat.update({
      where: { id: free.id },
      data: { userId: args.userId, displayName: args.displayName },
    });
    return free.seatIndex;
  } catch (error) {
    // Two people racing for the last seat. The loser is told the match is full
    // rather than shown a crash.
    if ((error as { code?: string })?.code === "P2002") return null;
    throw error;
  }
}

/** Start a lobby match. Empty seats stay empty and are played by the house. */
export async function startMatch(matchId: string): Promise<void> {
  await db.arenaMatch.update({
    where: { id: matchId },
    data: { status: "running", roundEndsAt: nextDeadline() },
  });
}

/** When the current round stops waiting for people. */
export function nextDeadline(now: Date = new Date()): Date {
  return new Date(now.getTime() + ROUND_SECONDS * 1_000);
}

/**
 * Stage one seat's decision for one round.
 *
 * An upsert against `@@unique([matchId, round, seatIndex])`, which is what makes
 * a double-submitted form, two tabs and a corrected slider all land on the same
 * row instead of three.
 */
export async function stageDecision(args: {
  matchId: string;
  round: number;
  seatIndex: number;
  payload: Record<string, number>;
  auto: boolean;
}): Promise<void> {
  const payload = JSON.stringify(args.payload);
  await db.arenaDecision.upsert({
    where: {
      matchId_round_seatIndex: {
        matchId: args.matchId,
        round: args.round,
        seatIndex: args.seatIndex,
      },
    },
    create: { ...args, payload },
    update: { payload, auto: args.auto },
  });
}

/** This round's staged decisions, by seat. */
export function stagedFor(
  match: LoadedMatch,
  round: number,
): Record<number, { values: Record<string, number>; auto: boolean }> {
  const out: Record<number, { values: Record<string, number>; auto: boolean }> = {};
  for (const row of match.decisions) {
    if (row.round !== round) continue;
    try {
      out[row.seatIndex] = {
        values: JSON.parse(row.payload) as Record<string, number>,
        auto: row.auto,
      };
    } catch {
      // A malformed payload is a row that cannot be honoured; the timer will
      // carry the seat forward instead of the round wedging on it.
    }
  }
  return out;
}

export function journalOf(match: { journalJson: string }): RunJournal | null {
  return parseJournal(match.journalJson);
}

/**
 * Write a resolved round back, if nobody else got there first.
 *
 * A compare-and-swap on `round`, and it is doing real work rather than being
 * cautious. Resolution is triggered by whoever happens to load the page once
 * the timer has passed, so two players refreshing at the same instant both
 * arrive holding the same journal and both try to advance it — and because the
 * engine is deterministic they would each compute the SAME next round and then
 * apply it twice, moving the match two quarters on one quarter's decisions.
 *
 * `updateMany` with the expected round in the WHERE clause makes the database
 * pick a winner. The loser gets `count: 0`, returns false, and re-reads.
 *
 * `round` is written from the journal's own length rather than from anything a
 * caller passed in, so the stored counter cannot drift from what it counts.
 */
export async function commitRound(args: {
  matchId: string;
  expectedRound: number;
  journal: RunJournal;
  finished: boolean;
}): Promise<boolean> {
  const result = await db.arenaMatch.updateMany({
    where: { id: args.matchId, round: args.expectedRound },
    data: {
      journalJson: serialiseJournal(args.journal),
      round: args.journal.entries.length,
      status: args.finished ? "finished" : "running",
      roundEndsAt: args.finished ? null : nextDeadline(),
      finishedAt: args.finished ? new Date() : null,
    },
  });
  return result.count > 0;
}

/** Final scores, written once when the last round resolves. */
export async function writeResults(
  matchId: string,
  results: { seatIndex: number; overall: number; scores: Record<string, number>; placing: number }[],
): Promise<void> {
  await db.$transaction(
    results.map((r) =>
      db.arenaSeat.updateMany({
        where: { matchId, seatIndex: r.seatIndex },
        data: {
          overall: r.overall,
          scoresJson: JSON.stringify(r.scores),
          placing: r.placing,
        },
      }),
    ),
  );
}

/**
 * Hand a seat back to the house.
 *
 * Nulling `userId` is the whole operation, because that field IS the answer to
 * "is a person playing this seat" — there is no second flag to keep in step.
 * The persona already sitting there plays the rest of the match.
 */
export async function vacateSeat(matchId: string, userId: string): Promise<void> {
  await db.arenaSeat.updateMany({
    where: { matchId, userId },
    data: { userId: null },
  });
}

/** The config a live match plays on, rebuilt from its seats. */
export function configFor(match: LoadedMatch): MatchConfig | null {
  return specialise({
    gameSlug: match.configSlug,
    seed: match.seed,
    seats: match.seats.map((s) => ({
      seatIndex: s.seatIndex,
      userId: s.userId,
      personaId: s.personaId,
    })),
  });
}

/**
 * Advance the match if the round is ready — every human in, or the clock out.
 *
 * **There is no cron.** The deadline is evaluated when somebody asks, exactly as
 * `lib/daily-unlock.ts` derives the day's question from the clock rather than
 * from a scheduled job: nothing to fail at midnight, nothing to backfill after
 * downtime, and no cold-start problem on serverless. Whoever loads the page or
 * commits a quarter is what moves the world on.
 *
 * It lives here rather than in `app/actions/arena.ts` for a reason worth
 * stating: this is the core game rule, and an action module cannot be reached
 * by a test or a script because `lib/auth.ts` pulls in `server-only`. A rule
 * nobody can exercise outside a browser is a rule nobody checks. The actions,
 * the page and the poll route all call it from here.
 *
 * Exported so the page and the poll route can both call it. Safe to call at any
 * time and from anywhere: it does nothing unless the round is genuinely due, and
 * `commitRound` is a compare-and-swap so two callers racing produce one round.
 */
export async function resolveIfDue(matchId: string): Promise<void> {
  const match = await loadMatch(matchId);
  if (!match || match.status !== "running") return;

  const config = configFor(match);
  if (!config) return;

  const journal = journalOf(match);
  const state = replayMatch({ config, seed: match.seed, journal });
  if (state.round >= config.horizon) return;

  const humans = match.seats.filter((s) => s.userId !== null);
  const staged = stagedFor(match, state.round);

  const plan = planRound({
    humanSeats: humans.map((s) => s.seatIndex),
    committedSeats: Object.keys(staged).map(Number),
    roundEndsAt: match.roundEndsAt,
  });
  if (!plan.due) return;

  // Whoever did not choose plays what they played last quarter. Recorded as an
  // auto-commit so the board can say so rather than passing it off as a
  // decision somebody made.
  const decision: Record<string, number> = {};
  for (const seat of humans) {
    const chosen = staged[seat.seatIndex]?.values;
    const values = chosen ?? carryForward(config, seat.seatIndex, state.ctx.state.current);
    if (!chosen) {
      await stageDecision({
        matchId,
        round: state.round,
        seatIndex: seat.seatIndex,
        payload: values,
        auto: true,
      });
    }
    Object.assign(decision, namespaceDecision(seat.seatIndex, values));
  }

  const stepped = stepMatch(state, decision, config);
  const finished = stepped.round >= config.horizon;

  const won = await commitRound({
    matchId,
    expectedRound: state.round,
    journal: stepped.ctx.journal,
    finished,
  });
  // Somebody else advanced this round first. Their result is identical — the
  // engine is deterministic — so there is nothing to reconcile, only to drop.
  if (!won) return;

  if (finished) {
    const { scores, placings } = scoreMatch({
      config,
      state: stepped.ctx.state,
      seed: match.seed,
      humanSeats: humans.map((s) => s.seatIndex),
    });
    await writeResults(
      matchId,
      scores.map((s) => ({
        seatIndex: s.seatIndex,
        overall: s.overall,
        scores: s.scores,
        placing: placings[s.seatIndex] ?? 0,
      })),
    );
  }
}

/** Matches this person is sitting in or has finished, newest first. */
export async function matchesFor(userId: string, take = 10) {
  return db.arenaMatch.findMany({
    where: { seats: { some: { userId } } },
    orderBy: { createdAt: "desc" },
    take,
    include: { seats: { orderBy: { seatIndex: "asc" } } },
  });
}

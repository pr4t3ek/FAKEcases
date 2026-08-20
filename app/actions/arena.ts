"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getSessionUser } from "@/lib/auth";
import {
  createMatchRow,
  journalOf,
  loadMatch,
  loadMatchByCode,
  matchesFor,
  resolveIfDue,
  stageDecision,
  startMatch,
  takeSeat,
  vacateSeat,
  type LoadedMatch,
} from "@/lib/arena";
import { ARENA_WALL, canPlayArena } from "@/lib/arena/access";
import { DEFAULT_GAME_SLUG, isArenaGame } from "@/lib/arena/registry";

import { sanitiseDecision } from "@/lib/arena/run";
import { specialise, type MatchConfig } from "@/lib/arena/setup";
import { isArenaMode, type ArenaMode } from "@/lib/arena/types";
import { normaliseRoomCode } from "@/lib/rooms/code";

export interface ArenaResult {
  ok: boolean;
  error?: string;
  matchId?: string;
}

/**
 * The gate, and it is the gate — the nav link is a courtesy.
 *
 * Every exported action starts here, which is the invariant `lib/entitlements.ts`
 * exists to protect restated for a surface that is deliberately not part of the
 * tier ladder.
 */
async function requirePlayer() {
  const user = await getSessionUser();
  if (!canPlayArena(user)) return null;
  return user;
}

/** The config a live match plays on, rebuilt from its seats. */
function configFor(match: LoadedMatch): MatchConfig | null {
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

function displayNameFor(user: { name: string | null; email: string | null }): string {
  const first = user.name?.trim().split(/\s+/)[0];
  return first || user.email?.split("@")[0] || "Player";
}

// ─── Opening a match ───────────────────────────────────────────────────────

export async function startSolo(gameSlug = DEFAULT_GAME_SLUG): Promise<never> {
  const user = await requirePlayer();
  if (!user) redirect(ARENA_WALL);
  if (!isArenaGame(gameSlug)) redirect("/arena");

  const match = await createMatchRow({
    hostId: user.id,
    configSlug: gameSlug,
    mode: "solo",
    hostName: displayNameFor(user),
  });
  if (!match) redirect("/arena?error=full");

  redirect(`/arena/${match.id}`);
}

export async function createMatch(mode: string = "multi"): Promise<never> {
  const user = await requirePlayer();
  if (!user) redirect(ARENA_WALL);

  const chosen: ArenaMode = isArenaMode(mode) ? mode : "multi";
  const match = await createMatchRow({
    hostId: user.id,
    configSlug: DEFAULT_GAME_SLUG,
    mode: chosen,
    hostName: displayNameFor(user),
  });
  if (!match) redirect("/arena?error=full");

  redirect(`/arena/${match.id}`);
}

export async function joinMatch(rawCode: string): Promise<ArenaResult> {
  const user = await requirePlayer();
  if (!user) return { ok: false, error: "The Arena is not open on your account." };

  const code = normaliseRoomCode(rawCode ?? "");
  if (!code) return { ok: false, error: "Enter a match code." };

  const match = await loadMatchByCode(code);
  // One message for "no such match" and for "that match has started", so a code
  // cannot be probed for which of the two it is.
  if (!match || match.status !== "lobby") {
    return { ok: false, error: "No open match with that code." };
  }

  const seat = await takeSeat({
    matchId: match.id,
    userId: user.id,
    displayName: displayNameFor(user),
  });
  if (seat === null) return { ok: false, error: "That match is full." };

  revalidatePath(`/arena/${match.id}`);
  return { ok: true, matchId: match.id };
}

/** The host drops the lobby into quarter one. Empty seats are played by the house. */
export async function beginMatch(matchId: string): Promise<ArenaResult> {
  const user = await requirePlayer();
  if (!user) return { ok: false, error: "The Arena is not open on your account." };

  const match = await loadMatch(matchId);
  if (!match) return { ok: false, error: "Not found" };
  if (match.hostId !== user.id) return { ok: false, error: "Only the host can start the match." };
  if (match.status !== "lobby") return { ok: true, matchId };

  await startMatch(matchId);
  revalidatePath(`/arena/${matchId}`);
  return { ok: true, matchId };
}

/** Give a seat back to the house and leave. The match carries on without you. */
export async function leaveMatch(matchId: string): Promise<ArenaResult> {
  const user = await requirePlayer();
  if (!user) return { ok: false, error: "The Arena is not open on your account." };

  await vacateSeat(matchId, user.id);
  await resolveIfDue(matchId);
  revalidatePath(`/arena/${matchId}`);
  return { ok: true, matchId };
}

// ─── Playing ───────────────────────────────────────────────────────────────

/**
 * Stage this seat's quarter, then see whether the round can resolve.
 *
 * The round index is read from the journal and never from the request — the
 * rule `submitMonth` sets for config-driven runs, and the reason a replayed
 * match cannot be walked forward by a hand-rolled call.
 */
export async function commitQuarter(
  matchId: string,
  values: Record<string, unknown>,
): Promise<ArenaResult> {
  const user = await requirePlayer();
  if (!user) return { ok: false, error: "The Arena is not open on your account." };

  const match = await loadMatch(matchId);
  if (!match) return { ok: false, error: "Not found" };
  if (match.status !== "running") return { ok: false, error: "This match is not running." };

  const seat = match.seats.find((s) => s.userId === user.id);
  if (!seat) return { ok: false, error: "You are not sitting in this match." };

  const config = configFor(match);
  if (!config) return { ok: false, error: "This game is no longer available." };

  const round = journalOf(match)?.entries.length ?? 0;
  await stageDecision({
    matchId,
    round,
    seatIndex: seat.seatIndex,
    payload: sanitiseDecision(config, values),
    auto: false,
  });

  await resolveIfDue(matchId);
  revalidatePath(`/arena/${matchId}`);
  return { ok: true, matchId };
}

/** Every match this account has a seat in. */
export async function myMatches() {
  const user = await requirePlayer();
  if (!user) return [];
  return matchesFor(user.id);
}

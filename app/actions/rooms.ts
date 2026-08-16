"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getOrCreateGuest, getSessionUser } from "@/lib/auth";
import { canOpen, tierFor } from "@/lib/entitlements";
import { canHostRooms } from "@/lib/types";
import { scenarioExists } from "@/lib/scenario-store";
import { isSimulatorSlug } from "@/lib/sim/configs/registry";
import { createLimiter } from "@/lib/rate-limit";
import { normaliseRoomCode } from "@/lib/rooms/code";
import { JOIN_REFUSED_MESSAGE, canJoinRoom } from "@/lib/rooms/access";
import {
  createRoomRow,
  loadRoom,
  loadRoomById,
  roomPasswordMatches,
  setRoomPassword,
  setRoomStatus,
  takeSeat,
} from "@/lib/rooms";

/**
 * Validation failures are RETURNED, not thrown — the convention
 * `app/actions/admin.ts` states: Next redacts a thrown Server Action error in
 * production, so a throw would reach a professor mid-class as "an error
 * occurred" when the actual problem is a six-character password.
 */
export interface RoomResult {
  ok: boolean;
  error?: string;
  /** The room's code, on success. */
  code?: string;
}

/** Mirrors `assertAdmin`. Genuinely exceptional, so this one throws. */
async function assertHost() {
  const user = await getSessionUser();
  if (!user || !canHostRooms(user.role)) throw new Error("Forbidden");
  return user;
}

/**
 * Prove the caller owns this room before they may change it.
 *
 * Ownership is re-derived from the session on every call and never taken from
 * the request — the posture `ownedRun` states in `app/actions/simulations.ts`.
 * Admins pass, because they can grant themselves the role anyway and a support
 * request to close a forgotten room should not require impersonation.
 */
async function ownedRoom(roomId: string) {
  const user = await assertHost();
  const room = await loadRoomById(roomId);
  if (!room) return null;
  if (room.hostId !== user.id && user.role !== "admin") return null;
  return { user, room };
}

const createSchema = z.object({
  questionId: z.string().min(1),
  name: z.string().trim().min(2, "Give the room a name").max(60),
  // The same floor as signup. A room password is a password.
  password: z.string().min(6, "Use at least 6 characters"),
});

/**
 * Open a room on a war room the host picked from the catalogue.
 *
 * **Gated on the HOST's own tier, with no grant.** A professor who cannot open a
 * scenario cannot host it either — otherwise the role is a way to hand the
 * entire paid catalogue to sixty people, and the paywall becomes a formality
 * anyone with a teaching account can waive. An admin pairs "make professor" with
 * a Pro grant when a professor should reach the paid set; the two buttons sit
 * next to each other for exactly this reason.
 */
export async function createRoom(input: unknown): Promise<RoomResult> {
  const host = await assertHost();

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const question = await db.question.findUnique({
    where: { id: parsed.data.questionId },
    select: { id: true, externalId: true, type: true, freeTier: true },
  });
  if (!question || question.type !== "simulation") {
    return { ok: false, error: "That isn't a war room." };
  }

  // The same two-registry check `startSimulation` does, so a room can never be
  // opened on a catalogue row with no runtime behind it — which would strand a
  // whole class at the door rather than one person.
  const slug = question.externalId;
  if (!slug || !(scenarioExists(slug) || isSimulatorSlug(slug))) {
    return { ok: false, error: "That war room has no scenario behind it yet." };
  }

  if (!canOpen(tierFor(host), question)) {
    return {
      ok: false,
      error: "Your own account can't open that one, so you can't host it. Ask an admin for a Pro pass.",
    };
  }

  const code = await createRoomRow({
    hostId: host.id,
    questionId: question.id,
    name: parsed.data.name,
    password: parsed.data.password,
  });
  if (!code) return { ok: false, error: "Couldn't allocate a room code. Try again." };

  revalidatePath("/host");
  return { ok: true, code };
}

export async function closeRoom(roomId: string): Promise<RoomResult> {
  const owned = await ownedRoom(roomId);
  if (!owned) return { ok: false, error: "No such room." };

  // Status only. Runs already under way are deliberately untouched — see the
  // note on `SimRoom.status`.
  await setRoomStatus(roomId, "closed");
  revalidatePath("/host");
  revalidatePath(`/host/${owned.room.code}`);
  return { ok: true, code: owned.room.code };
}

export async function reopenRoom(roomId: string): Promise<RoomResult> {
  const owned = await ownedRoom(roomId);
  if (!owned) return { ok: false, error: "No such room." };

  await setRoomStatus(roomId, "open");
  revalidatePath("/host");
  revalidatePath(`/host/${owned.room.code}`);
  return { ok: true, code: owned.room.code };
}

/**
 * Set a new room password.
 *
 * Required rather than a nicety: the stored hash is one-way, so the console
 * cannot show a professor what they set an hour ago. Without this, forgetting it
 * mid-class means deleting the room the students have already joined.
 */
export async function resetRoomPassword(roomId: string, password: string): Promise<RoomResult> {
  const owned = await ownedRoom(roomId);
  if (!owned) return { ok: false, error: "No such room." };
  if (typeof password !== "string" || password.length < 6) {
    return { ok: false, error: "Use at least 6 characters." };
  }

  await setRoomPassword(roomId, password);
  revalidatePath(`/host/${owned.room.code}`);
  return { ok: true, code: owned.room.code };
}

const joinSchema = z.object({
  code: z.string().min(1),
  password: z.string().min(1),
  name: z.string().trim().min(1, "Tell us what to call you").max(40),
});

/**
 * Eight attempts a minute. Generous for someone retyping a code off a
 * whiteboard, mean for anyone working through the keyspace.
 */
const joinLimiter = createLimiter({ windowMs: 60_000, max: 8 });

/**
 * Take a seat in a room.
 *
 * The only action here that is not host-gated, and the order of operations
 * matters more than usual:
 *
 * 1. Rate-limit FIRST, before any lookup.
 * 2. Every failure returns the SAME message. Distinguishing "no such room" from
 *    "wrong password" turns this form into an oracle for which codes exist, and
 *    tells the student nothing — they typed all three fields off the same
 *    whiteboard and have to recheck all three anyway.
 * 3. `getOrCreateGuest` runs LAST, after the password verifies. Minting the row
 *    first would mean every wrong guess creates a `User`.
 */
export async function joinRoom(input: unknown): Promise<RoomResult> {
  const existing = await getSessionUser();

  // Session first, forwarded IP second. Neither is trustworthy on its own; the
  // limiter is best-effort by construction (see lib/rate-limit).
  const forwarded = (await headers()).get("x-forwarded-for") ?? "anon";
  if (!joinLimiter.check(existing?.id ?? forwarded).ok) {
    return { ok: false, error: "Too many attempts. Wait a minute and try again." };
  }

  const parsed = joinSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const code = normaliseRoomCode(parsed.data.code);
  const room = await loadRoom(code);

  if (!canJoinRoom(room).ok) return { ok: false, error: JOIN_REFUSED_MESSAGE };
  if (!roomPasswordMatches(room!, parsed.data.password)) {
    return { ok: false, error: JOIN_REFUSED_MESSAGE };
  }

  const user = existing ?? (await getOrCreateGuest());

  await takeSeat({ roomId: room!.id, userId: user.id, displayName: parsed.data.name });

  // A guest's account name is literally "Guest", and it is what the debrief and
  // any leaderboard they reach will show. Setting it here is the only chance:
  // the student told us their name at the door and will not be asked again.
  // A registered account keeps its own name — the seat carries the room's label.
  if (user.isGuest) {
    await db.user.update({ where: { id: user.id }, data: { name: parsed.data.name } });
  }

  revalidatePath(`/host/${room!.code}`);
  return { ok: true, code: room!.code };
}

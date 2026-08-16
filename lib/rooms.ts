/**
 * Data access for classroom rooms — the counterpart to `lib/simulations.ts`.
 *
 * Everything that touches Prisma for a room goes through here, so the rules
 * under `lib/rooms/` stay pure and testable and the server actions stay thin.
 *
 * Note what is absent: nothing in this file writes a `SimRun`, an `Evaluation`
 * or a `LeaderboardEntry`. A room grants access and collects a roster; the run
 * itself is opened by `app/actions/simulations.ts` exactly as a solo run is.
 * That is what keeps `lib/sim/` from ever learning that classrooms exist.
 */

import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { generateRoomCode, normaliseRoomCode } from "@/lib/rooms/code";
import { grantFromRooms } from "@/lib/rooms/access";
import { buildRoster, type Roster } from "@/lib/rooms/roster";
import type { AccessGrant } from "@/lib/entitlements";
import { NO_GRANT } from "@/lib/entitlements";

/** A room with the bits every caller needs: the question, and how many joined. */
export type LoadedRoom = NonNullable<Awaited<ReturnType<typeof loadRoom>>>;

export async function loadRoom(code: string) {
  return db.simRoom.findUnique({
    where: { code: normaliseRoomCode(code) },
    include: {
      question: true,
      _count: { select: { members: true } },
    },
  });
}

export async function loadRoomById(id: string) {
  return db.simRoom.findUnique({
    where: { id },
    include: { question: true, _count: { select: { members: true } } },
  });
}

/**
 * Open a room, retrying past a code collision.
 *
 * The unique constraint on `code` is the control; this loop is the courtesy. At
 * ~1.07e9 codes a collision is a lottery ticket, and the retry exists so that
 * stays a fact rather than an assumption — the alternative is a professor
 * meeting a raw Prisma error in front of a class.
 */
export async function createRoomRow(args: {
  hostId: string;
  questionId: string;
  name: string;
  password: string;
}): Promise<string | null> {
  const passwordHash = hashPassword(args.password);

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode();
    try {
      await db.simRoom.create({
        data: {
          code,
          passwordHash,
          name: args.name,
          hostId: args.hostId,
          questionId: args.questionId,
        },
      });
      return code;
    } catch (error) {
      // The race the constraint exists for. Anything else is a real failure and
      // must not be swallowed as a collision.
      if ((error as { code?: string })?.code === "P2002") continue;
      throw error;
    }
  }
  return null;
}

export async function setRoomStatus(roomId: string, status: "open" | "closed"): Promise<void> {
  await db.simRoom.update({
    where: { id: roomId },
    data: { status, closedAt: status === "closed" ? new Date() : null },
  });
}

export async function setRoomPassword(roomId: string, password: string): Promise<void> {
  await db.simRoom.update({
    where: { id: roomId },
    data: { passwordHash: hashPassword(password) },
  });
}

/** Whether this password opens this room. Kept here because the hash lives here. */
export function roomPasswordMatches(room: { passwordHash: string }, password: string): boolean {
  return verifyPassword(password, room.passwordHash);
}

/**
 * Take a seat, or update the name on the one already taken.
 *
 * An upsert against `@@unique([roomId, userId])`, which is what makes a
 * double-submitted form, a reloaded page and a student correcting a typo'd name
 * all land on the same row instead of three rows on the professor's roster.
 */
export async function takeSeat(args: {
  roomId: string;
  userId: string;
  displayName: string;
}): Promise<void> {
  await db.simRoomMember.upsert({
    where: { roomId_userId: { roomId: args.roomId, userId: args.userId } },
    create: args,
    update: { displayName: args.displayName },
  });
}

/** This person's seat in this room, with the room and its question attached. */
export async function seatFor(userId: string, code: string) {
  const room = await loadRoom(code);
  if (!room) return null;

  const seat = await db.simRoomMember.findUnique({
    where: { roomId_userId: { roomId: room.id, userId } },
  });
  if (!seat) return null;

  return { room, seat };
}

/**
 * The questions this user may open by virtue of a room they are sitting in.
 *
 * **The one derivation, and it is never inlined at a call site.** The
 * "one function, both callers" invariant in `lib/entitlements.ts` survives the
 * classroom grant only because both sides of a surface — the page that renders
 * the button and the action that honours it — call this. Two call sites deriving
 * a grant slightly differently is precisely the drift that file exists to
 * prevent.
 *
 * Only open rooms count; the filtering rule itself is in `lib/rooms/access.ts`
 * so a test can reach it.
 */
export async function roomGrantFor(userId: string | null | undefined): Promise<AccessGrant> {
  if (!userId) return NO_GRANT;

  const seats = await db.simRoomMember.findMany({
    where: { userId },
    select: { room: { select: { questionId: true, status: true } } },
  });

  return grantFromRooms(seats.map((s) => s.room));
}

/** The host's rooms, newest first, with enough to render a card. */
export async function listRoomsForHost(hostId: string) {
  return db.simRoom.findMany({
    where: { hostId },
    orderBy: { createdAt: "desc" },
    include: {
      question: { select: { title: true, difficulty: true } },
      _count: { select: { members: true, runs: true } },
    },
  });
}

/**
 * The console's table.
 *
 * Two queries rather than one join, because the roster is seat-driven: a student
 * who joined and has not started must still get a row, and a join would drop
 * them. The shaping itself is `buildRoster`, which is pure — this function is
 * only the reads.
 */
export async function loadRoster(roomId: string): Promise<Roster> {
  const [seats, runs] = await Promise.all([
    db.simRoomMember.findMany({
      where: { roomId },
      select: {
        userId: true,
        displayName: true,
        joinedAt: true,
        user: { select: { email: true } },
      },
    }),
    db.simRun.findMany({
      where: { roomId },
      select: {
        id: true,
        userId: true,
        phase: true,
        daysSpent: true,
        createdAt: true,
        // `daysPar` is the authored budget for the scenario. Carried so the
        // console can draw the line between "came in under budget" and "over"
        // rather than showing a cloud of unanchored dots.
        result: {
          select: { overall: true, band: true, causeFound: true, daysPar: true },
        },
      },
    }),
  ]);

  return buildRoster(
    seats.map((s) => ({
      userId: s.userId,
      displayName: s.displayName,
      joinedAt: s.joinedAt,
      email: s.user.email,
    })),
    runs,
  );
}

/**
 * Move a guest's seats onto the account they just signed in to.
 *
 * Mirrors `mergeGuestEntries` in `lib/leaderboard.ts`, and for the same reason:
 * `@@unique([roomId, userId])` makes a blind `updateMany` throw the moment the
 * real account is already sitting in that room. So read both sides, move only
 * the seats whose room the target does not already hold, and let the rest
 * cascade away with the guest row.
 *
 * The guest's `displayName` travels with a moved seat deliberately — that is the
 * name the professor has been reading off the roster for the last ten minutes,
 * and swapping it for an account name mid-class is a worse answer than keeping
 * it.
 */
export async function mergeGuestSeats(fromUserId: string, toUserId: string): Promise<void> {
  const [guestSeats, existing] = await Promise.all([
    db.simRoomMember.findMany({
      where: { userId: fromUserId },
      select: { id: true, roomId: true },
    }),
    db.simRoomMember.findMany({
      where: { userId: toUserId },
      select: { roomId: true },
    }),
  ]);

  const taken = new Set(existing.map((s) => s.roomId));
  const movable = guestSeats.filter((s) => !taken.has(s.roomId)).map((s) => s.id);
  if (movable.length) {
    await db.simRoomMember.updateMany({
      where: { id: { in: movable } },
      data: { userId: toUserId },
    });
  }
}

/**
 * What a room membership entitles someone to, and why a join was refused.
 *
 * Pure and DB-free, and the same posture as `lib/entitlements.ts`: the rule is
 * here so the server action and the page that renders the button call one
 * function rather than two implementations that drift.
 */

import type { AccessGrant } from "@/lib/entitlements";
import { NO_GRANT } from "@/lib/entitlements";
import type { RoomStatus } from "@/lib/types";

/** The shape this module needs off a room. Deliberately not a Prisma type. */
export interface GrantingRoom {
  questionId: string;
  status: string;
}

export function roomIsOpen(room: { status: string }): boolean {
  return room.status === ("open" satisfies RoomStatus);
}

/**
 * The questions these memberships open.
 *
 * **Only open rooms count**, and that single filter is what makes closing a room
 * a real control rather than a label: `startRoomRun` gates on the grant, so a
 * closed room refuses new runs without any call site having to remember to check
 * the status. It is also what stops last term's membership quietly holding a war
 * room open forever.
 *
 * Deduped, because two professors may host the same scenario and a grant is a
 * set, not a tally.
 */
export function grantFromRooms(rooms: GrantingRoom[]): AccessGrant {
  const ids = new Set<string>();
  for (const room of rooms) {
    if (roomIsOpen(room)) ids.add(room.questionId);
  }
  return ids.size ? { questionIds: [...ids] } : NO_GRANT;
}

/**
 * Why a join did not go through.
 *
 * One value, `refused`, covers an unknown code, a closed room AND a wrong
 * password — deliberately. Distinct messages would turn the join form into an
 * oracle for which codes exist, and the person who benefits from that
 * distinction is never the student, who typed all three fields from the same
 * whiteboard and needs to check all three anyway.
 */
export type JoinRefusal = "refused" | "invalid";

export interface JoinDecision {
  ok: boolean;
  reason?: JoinRefusal;
}

export const JOIN_REFUSED_MESSAGE =
  "That code and password don't match an open room. Check all three fields and try again.";

/**
 * Whether this room can be joined at all, before the password is checked.
 *
 * A missing room and a closed one return the same refusal for the reason above.
 * The password check stays at the call site because it needs the hash, and
 * hashing is not something a pure module should be reaching for.
 */
export function canJoinRoom(room: { status: string } | null | undefined): JoinDecision {
  if (!room || !roomIsOpen(room)) return { ok: false, reason: "refused" };
  return { ok: true };
}

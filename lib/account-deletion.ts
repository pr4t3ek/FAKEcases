/**
 * Deleting an account, without deleting other people's work.
 *
 * A plain `db.user.delete()` would be almost right. Every required foreign key
 * pointing at `User` declares `onDelete: Cascade`, so the profile (avatar bytes
 * and all), the attempts and their transcripts, the evaluations, the progress
 * rollup, the achievements, the bookmarks and the leaderboard entries all go on
 * their own, which is exactly what a deletion should do.
 *
 * Three of those cascades are wrong here, and each destroys data belonging to
 * somebody who did not ask for anything:
 *
 *   - `SimRoomMember.userId` cascades, so a student's SEAT disappears.
 *   - `SimRun.userId` cascades, so their class RUN and its `SimResult` disappear.
 *   - `SimRoom.hostId` cascades, so a professor's whole ROOM disappears — and
 *     that takes every student's seat in it with it.
 *
 * `buildRoster` (`lib/rooms/roster.ts`) is seat-driven and ignores a run whose
 * `userId` is not a seat in the room, so losing either half of the first two
 * removes the student from the roster, the class standings and the cost-vs-score
 * scatter — retroactively, weeks after the class. That is the outcome
 * `SimRun.roomId`'s own schema comment exists to prevent: "a professor tidying
 * up after term must not delete the work sixty students did."
 *
 * ## The tombstone
 *
 * So the classroom footprint is MOVED before the row goes, onto a fresh
 * anonymous `User` minted for this deletion alone. The alternative — making
 * `SimRun.userId` and `SimRoomMember.userId` nullable — would ripple through
 * `ownedRun`, `findResumableRun`, `simStateByQuestion`, `buildRoster` and the
 * leaderboard, every one of which types those fields as a non-null `string`.
 *
 * Moving rows off a user about to be deleted is a thing this codebase already
 * does: `login()` in `lib/auth.ts` migrates a guest's attempts, runs, seats and
 * ranked entries onto the account they signed in to, and then deletes the guest.
 * Its comment is the rule this module obeys — "anything worth keeping has to be
 * moved before that line, and forgetting one is silent."
 *
 * A tombstone is minted ONLY when there is something to preserve. An account
 * that never joined or hosted a room — most of them — is deleted outright and
 * leaves nothing behind.
 */

import { db } from "@/lib/db";
import { getAvatarStore } from "@/lib/storage";
import type { RoomStatus } from "@/lib/types";

/** What the roster shows in place of a student who deleted their account. */
export const DELETED_MEMBER_NAME = "Deleted student";

/** The tombstone's account name, seen only by an admin looking at the user list. */
export const TOMBSTONE_NAME = "Deleted account";

export interface DeleteOutcome {
  /**
   * The tombstone's id, or null when the account had no classroom footprint and
   * nothing needed to survive it.
   */
  tombstoneId: string | null;
  /** Seats moved onto the tombstone. */
  seats: number;
  /** Class runs moved. Solo runs are not moved — they are personal work. */
  classRuns: number;
  /** Rooms moved and closed. */
  hostedRooms: number;
}

/**
 * Delete an account.
 *
 * The caller is responsible for deciding this is allowed — `app/actions/user.ts`
 * proves the session owns the account, `app/actions/admin.ts` proves the caller
 * is an admin. This function does not re-check, in the same way `grantPro` does
 * not: it takes an id that has already been authorised.
 *
 * Ends the session? No — that is the action's job, since only a Server Action
 * may write the cookie.
 */
export async function deleteAccount(userId: string): Promise<DeleteOutcome> {
  // 1. What would be destroyed that shouldn't be. Read before anything is
  //    written, so the decision to mint a tombstone is made against one
  //    consistent picture.
  const [seats, hostedRooms, classRuns] = await Promise.all([
    db.simRoomMember.findMany({ where: { userId }, select: { id: true } }),
    db.simRoom.findMany({ where: { hostId: userId }, select: { id: true } }),
    // Class runs only. A solo run is this person's own work and goes with them —
    // which is the whole difference between "delete my account" and "hide me".
    db.simRun.findMany({
      where: { userId, roomId: { not: null } },
      select: { id: true },
    }),
  ]);

  const outcome: DeleteOutcome = {
    tombstoneId: null,
    seats: seats.length,
    classRuns: classRuns.length,
    hostedRooms: hostedRooms.length,
  };

  if (seats.length || hostedRooms.length || classRuns.length) {
    // 2. Mint the tombstone. `isGuest: true` is load-bearing rather than
    //    cosmetic: it is what keeps this row out of `recomputeRank`'s population
    //    (lib/progress.ts filters `isGuest: false`) and out of every public board
    //    via `rankableUser` (lib/leaderboard.ts) — with no new filter to add at
    //    either site. No email and no passwordHash, so nothing can sign in as it.
    const tombstone = await db.user.create({
      data: {
        name: TOMBSTONE_NAME,
        isGuest: true,
        deletedAt: new Date(),
      },
      select: { id: true },
    });
    outcome.tombstoneId = tombstone.id;

    // 3. Move the footprint in ONE transaction. A half-moved footprint is a
    //    roster that disagrees with itself — the seat gone but the run kept, or
    //    a room whose host no longer exists — and nobody would be able to tell
    //    which half landed. Same reasoning `updateProfile` gives for its pair.
    //
    //    Note these are plain `updateMany`s, unlike `mergeGuestSeats`, which has
    //    to read-then-move around `@@unique([roomId, userId])`. There is nothing
    //    to collide with here: the tombstone was created a line ago and holds no
    //    seats, and the deleted user held at most one seat per room by that same
    //    constraint.
    await db.$transaction([
      db.simRoomMember.updateMany({
        where: { userId },
        // The display name goes too. The professor asked for the roster to
        // survive, not for the name of someone who deleted their account to
        // stay on a screen they read out in class.
        data: { userId: tombstone.id, displayName: DELETED_MEMBER_NAME },
      }),
      db.simRun.updateMany({
        where: { userId, roomId: { not: null } },
        data: { userId: tombstone.id },
      }),
      // Closed, not just re-hosted. A room whose professor has deleted their
      // account has no one to run it, and `grantFromRooms` counts open rooms
      // only — so closing it is what lets the students' grants lapse and
      // `startRoomRun` refuse new runs, both without a single call site
      // learning about deleted accounts. An admin can still reopen it:
      // `ownedRoom` lets `role === "admin"` through, which is the only way
      // back into a room with no host.
      db.simRoom.updateMany({
        where: { hostId: userId },
        data: {
          hostId: tombstone.id,
          status: "closed" satisfies RoomStatus,
          closedAt: new Date(),
        },
      }),
    ]);
  }

  // 4. `QuestionFeedback.userId` is optional and cascades to null on its own, so
  //    a bug report survives without its reporter — which is right, the report is
  //    about a question. But `attemptId` beside it is a bare String column with
  //    no relation behind it, so nothing would clear it and it would be left
  //    naming an attempt that no longer exists. Nothing reads it today; this is
  //    one line so that stays true if something ever does.
  await db.questionFeedback.updateMany({
    where: { userId },
    data: { attemptId: null },
  });

  // 5. Redundant under the built-in `db` store, whose bytes sit on `Profile` and
  //    cascade — but it is the line that keeps this correct the day a second
  //    provider lands, and `remove` is documented safe to call when there is
  //    nothing there. Before the delete, because afterwards there is no id to
  //    hand it.
  await getAvatarStore().remove(userId);

  // 6. Everything still pointing here now either cascades or is meant to go.
  await db.user.delete({ where: { id: userId } });

  return outcome;
}

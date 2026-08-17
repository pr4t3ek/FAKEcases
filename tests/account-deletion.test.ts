import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * What a deletion takes, and the narrow set of things it deliberately leaves.
 *
 * Only the database and the avatar store are mocked; the decision about when a
 * tombstone is needed and what moves onto it is the real one.
 *
 * The case that motivates the whole module is the last two: a student who
 * deletes their account must not blank a professor's roster, and a professor who
 * deletes theirs must not take sixty students' work with them. Both are
 * cascade-shaped and therefore silent — nothing throws, the rows are simply gone
 * — so they are pinned here rather than trusted to the schema.
 */
const seatFindMany = vi.fn();
const roomFindMany = vi.fn();
const runFindMany = vi.fn();
const seatUpdateMany = vi.fn();
const roomUpdateMany = vi.fn();
const runUpdateMany = vi.fn();
const feedbackUpdateMany = vi.fn();
const userCreate = vi.fn();
const userDelete = vi.fn();
const transaction = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    simRoomMember: { findMany: seatFindMany, updateMany: seatUpdateMany },
    simRoom: { findMany: roomFindMany, updateMany: roomUpdateMany },
    simRun: { findMany: runFindMany, updateMany: runUpdateMany },
    questionFeedback: { updateMany: feedbackUpdateMany },
    user: { create: userCreate, delete: userDelete },
    $transaction: transaction,
  },
}));

const avatarRemove = vi.fn();
vi.mock("@/lib/storage", () => ({
  getAvatarStore: () => ({ name: "test", put: vi.fn(), remove: avatarRemove }),
}));

const { deleteAccount, DELETED_MEMBER_NAME } = await import("@/lib/account-deletion");

describe("deleteAccount", () => {
  beforeEach(() => {
    seatFindMany.mockReset().mockResolvedValue([]);
    roomFindMany.mockReset().mockResolvedValue([]);
    runFindMany.mockReset().mockResolvedValue([]);
    seatUpdateMany.mockReset().mockResolvedValue({ count: 0 });
    roomUpdateMany.mockReset().mockResolvedValue({ count: 0 });
    runUpdateMany.mockReset().mockResolvedValue({ count: 0 });
    feedbackUpdateMany.mockReset().mockResolvedValue({ count: 0 });
    userCreate.mockReset().mockResolvedValue({ id: "tomb" });
    userDelete.mockReset().mockResolvedValue(undefined);
    // The real `$transaction` takes an array of prepared queries and runs them;
    // the mocked Prisma methods have already been called by the time it is
    // handed them, which is what the assertions below read.
    transaction.mockReset().mockResolvedValue([]);
    avatarRemove.mockReset().mockResolvedValue(undefined);
  });

  /**
   * The common case by a wide margin. Someone who never joined a class has
   * nothing another person depends on, so a tombstone would be litter — a User
   * row that exists forever to stand in for relationships that were never there.
   */
  it("mints no tombstone when there is no classroom footprint", async () => {
    const outcome = await deleteAccount("u1");

    expect(userCreate).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
    expect(outcome.tombstoneId).toBeNull();
    expect(userDelete).toHaveBeenCalledWith({ where: { id: "u1" } });
  });

  /**
   * `buildRoster` is seat-driven and ignores a run whose user holds no seat, so
   * losing the seat removes the student from the roster, the standings and the
   * scatter — retroactively, weeks after the class.
   */
  it("moves a seat onto the tombstone and anonymises the display name", async () => {
    seatFindMany.mockResolvedValue([{ id: "seat1" }]);

    const outcome = await deleteAccount("u1");

    expect(outcome.tombstoneId).toBe("tomb");
    expect(seatUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u1" },
        data: { userId: "tomb", displayName: DELETED_MEMBER_NAME },
      }),
    );
  });

  /** The tombstone must not land in the rank population or on a public board. */
  it("mints the tombstone as a guest with no credentials", async () => {
    seatFindMany.mockResolvedValue([{ id: "seat1" }]);

    await deleteAccount("u1");

    const data = userCreate.mock.calls[0][0].data;
    expect(data.isGuest).toBe(true);
    expect(data.deletedAt).toBeInstanceOf(Date);
    expect(data.email).toBeUndefined();
    expect(data.passwordHash).toBeUndefined();
  });

  /**
   * The distinction the whole "hard delete" promise rests on: a run played for a
   * class is evidence a professor is marking, and a solo run is this person's own
   * work. Only the first survives, and it survives because the query is filtered
   * — not because something downstream happens to keep it.
   */
  it("moves class runs only, never solo ones", async () => {
    runFindMany.mockResolvedValue([{ id: "run1" }]);

    await deleteAccount("u1");

    expect(runFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u1", roomId: { not: null } },
      }),
    );
    expect(runUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u1", roomId: { not: null } },
        data: { userId: "tomb" },
      }),
    );
  });

  /**
   * `SimRoom.hostId` cascades, so a professor's deletion would delete the room
   * and every seat in it. Re-hosting onto the tombstone is what keeps the room
   * — and closing it is what makes the students' grants lapse without any call
   * site learning that accounts can be deleted.
   */
  it("re-hosts a room onto the tombstone and closes it rather than deleting it", async () => {
    roomFindMany.mockResolvedValue([{ id: "room1" }]);

    const outcome = await deleteAccount("prof");

    expect(outcome.hostedRooms).toBe(1);
    const call = roomUpdateMany.mock.calls[0][0];
    expect(call.where).toEqual({ hostId: "prof" });
    expect(call.data.hostId).toBe("tomb");
    expect(call.data.status).toBe("closed");
    expect(call.data.closedAt).toBeInstanceOf(Date);
  });

  /**
   * `QuestionFeedback.attemptId` is a bare String column with no relation behind
   * it, so nothing clears it when the attempt cascades away. The report itself is
   * kept — it is about a question, and its `userId` nulls itself.
   */
  it("clears the dangling attempt pointer on surviving feedback", async () => {
    await deleteAccount("u1");

    expect(feedbackUpdateMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
      data: { attemptId: null },
    });
  });

  /**
   * Redundant under the built-in store, whose bytes cascade with `Profile` — but
   * it is what keeps the feature correct the day an object store lands, and after
   * the delete there is no id left to hand it.
   */
  it("asks the avatar store to drop the image before deleting the row", async () => {
    const order: string[] = [];
    avatarRemove.mockImplementation(async () => void order.push("avatar"));
    userDelete.mockImplementation(async () => void order.push("delete"));

    await deleteAccount("u1");

    expect(avatarRemove).toHaveBeenCalledWith("u1");
    expect(order).toEqual(["avatar", "delete"]);
  });

  /** Everything moves before the row goes, or it goes with the row. */
  it("moves the footprint before deleting the user", async () => {
    seatFindMany.mockResolvedValue([{ id: "seat1" }]);
    const order: string[] = [];
    transaction.mockImplementation(async () => void order.push("move"));
    userDelete.mockImplementation(async () => void order.push("delete"));

    await deleteAccount("u1");

    expect(order).toEqual(["move", "delete"]);
  });
});

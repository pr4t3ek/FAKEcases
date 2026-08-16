import { describe, expect, it } from "vitest";
import { canJoinRoom, grantFromRooms, roomIsOpen } from "@/lib/rooms/access";
import { canOpen, NO_GRANT } from "@/lib/entitlements";
import { USER_ROLES, canHostRooms, isUserRole } from "@/lib/types";

const open = (questionId: string) => ({ questionId, status: "open" });
const closed = (questionId: string) => ({ questionId, status: "closed" });

describe("grantFromRooms", () => {
  it("opens the question of an open room", () => {
    expect(grantFromRooms([open("q1")]).questionIds).toEqual(["q1"]);
  });

  it("opens nothing for a closed room", () => {
    // The single filter that makes closing a room a control rather than a
    // label: `startRoomRun` gates on the grant, so a closed room refuses new
    // runs without any call site remembering to check the status.
    expect(grantFromRooms([closed("q1")]).questionIds).toEqual([]);
  });

  it("carries every open room a student is in", () => {
    const grant = grantFromRooms([open("q1"), open("q2")]);
    expect([...grant.questionIds].sort()).toEqual(["q1", "q2"]);
  });

  it("ignores the closed rooms among the open ones", () => {
    const grant = grantFromRooms([open("q1"), closed("q2"), open("q3")]);
    expect([...grant.questionIds].sort()).toEqual(["q1", "q3"]);
  });

  it("dedupes when two rooms host the same scenario", () => {
    // Two professors, one war room, one grant. A tally here would be harmless
    // but it is a set, and saying so is cheaper than relying on it.
    expect(grantFromRooms([open("q1"), open("q1")]).questionIds).toEqual(["q1"]);
  });

  it("returns the shared empty grant when there is nothing to open", () => {
    expect(grantFromRooms([])).toBe(NO_GRANT);
    expect(grantFromRooms([closed("q1")])).toBe(NO_GRANT);
  });
});

describe("the grant, joined up with the entitlement gate", () => {
  /**
   * The end-to-end property the feature exists for, asserted across the two
   * pure modules rather than only inside each: a guest with no pass gets into
   * the room's war room and gets nothing else.
   */
  it("lets a guest open the hosted war room and nothing else", () => {
    const grant = grantFromRooms([open("hosted")]);
    expect(canOpen("guest", { id: "hosted", freeTier: false }, grant)).toBe(true);
    expect(canOpen("guest", { id: "another", freeTier: false }, grant)).toBe(false);
  });

  it("re-locks the moment the room closes", () => {
    const grant = grantFromRooms([closed("hosted")]);
    expect(canOpen("guest", { id: "hosted", freeTier: false }, grant)).toBe(false);
  });
});

describe("roomIsOpen", () => {
  it("is true only for the open status", () => {
    expect(roomIsOpen({ status: "open" })).toBe(true);
    expect(roomIsOpen({ status: "closed" })).toBe(false);
    // An unknown value is not open. Fail closed on a column that TypeScript
    // cannot constrain, since SQLite has no enums.
    expect(roomIsOpen({ status: "" })).toBe(false);
    expect(roomIsOpen({ status: "OPEN" })).toBe(false);
  });
});

describe("canJoinRoom", () => {
  it("admits an open room", () => {
    expect(canJoinRoom({ status: "open" }).ok).toBe(true);
  });

  /**
   * The oracle test. A join form that says "no such room" for one code and
   * "wrong password" for another tells an attacker which codes exist — and
   * tells the student nothing useful, since they typed all three fields off the
   * same whiteboard and have to recheck all three regardless.
   */
  it("gives a missing room and a closed room the same refusal", () => {
    const missing = canJoinRoom(null);
    const shut = canJoinRoom({ status: "closed" });
    expect(missing.ok).toBe(false);
    expect(shut.ok).toBe(false);
    expect(missing.reason).toBe(shut.reason);
  });

  it("treats undefined like a missing room", () => {
    expect(canJoinRoom(undefined).ok).toBe(false);
  });
});

describe("canHostRooms", () => {
  it("admits professors and admins", () => {
    expect(canHostRooms("professor")).toBe(true);
    expect(canHostRooms("admin")).toBe(true);
  });

  it("refuses an ordinary account", () => {
    expect(canHostRooms("user")).toBe(false);
  });

  it("refuses a role it has never heard of", () => {
    // The column is a plain String — SQLite has no enums — so an unknown value
    // is reachable, and it must fail closed.
    expect(canHostRooms("")).toBe(false);
    expect(canHostRooms("Professor")).toBe(false);
    expect(canHostRooms("superuser")).toBe(false);
  });

  /**
   * The guard that matters most, and the reason `requireHost` is a separate
   * function from `requireAdmin`. Hosting is a new capability, NOT a widening
   * of the admin gate: `app/admin/page.tsx`, `assertAdmin`,
   * `app/actions/sim-scenarios.ts`, `app/api/admin/import/route.ts` and
   * `requireAdmin` all still test `role !== "admin"` exactly. If someone ever
   * "simplifies" those to `canHostRooms`, this is the assertion that says why
   * they must not.
   */
  it("does not make a professor an admin", () => {
    // Spelled out as the two predicates side by side, because the claim is
    // about the relationship between them: hosting is strictly wider than
    // admin, and there is at least one role in the gap.
    const isAdmin = (role: string) => role === "admin";
    const canHostButNotAdmin = USER_ROLES.filter((r) => canHostRooms(r) && !isAdmin(r));

    expect(canHostButNotAdmin).toEqual(["professor"]);
    // And the containment that makes it "wider" rather than merely "different".
    expect(USER_ROLES.filter(isAdmin).every(canHostRooms)).toBe(true);
  });
});

describe("USER_ROLES", () => {
  it("holds exactly the three the app knows", () => {
    expect(USER_ROLES).toEqual(["user", "professor", "admin"]);
  });

  it("guards against anything else", () => {
    expect(isUserRole("professor")).toBe(true);
    expect(isUserRole("root")).toBe(false);
    expect(isUserRole("")).toBe(false);
  });

  it("defaults to the least privileged", () => {
    // `User.role` defaults to USER_ROLES[0] in the schema. If the order is ever
    // shuffled, the default silently becomes something else.
    expect(USER_ROLES[0]).toBe("user");
  });
});

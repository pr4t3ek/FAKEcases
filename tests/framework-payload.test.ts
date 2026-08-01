import { describe, expect, it } from "vitest";
import { frameworkSchema, MAX_NODES, type FrameworkNodePayload } from "@/lib/framework-payload";

const node = (
  id: string,
  parentId: string | null,
  over: Partial<FrameworkNodePayload> = {},
): FrameworkNodePayload => ({
  id,
  parentId,
  label: `Node ${id}`,
  combine: "sum",
  ...over,
});

const ok = (nodes: FrameworkNodePayload[]) => frameworkSchema.safeParse(nodes).success;

describe("frameworkSchema", () => {
  it("accepts a well-formed tree", () => {
    expect(ok([node("a", null), node("b", "a"), node("c", "a")])).toBe(true);
  });

  it("accepts an empty tree — clearing the board is a legitimate save", () => {
    expect(ok([])).toBe(true);
  });

  /**
   * The whole reason the schema exists. Before it, a dangling parentId reached
   * the database only after the old tree had been deleted, so a client bug cost
   * the candidate their work. Rejecting here means the save is a no-op instead.
   */
  it("rejects a parentId that names no node in the payload", () => {
    expect(ok([node("a", null), node("b", "ghost")])).toBe(false);
  });

  it("rejects a node that is its own parent", () => {
    expect(ok([node("a", "a")])).toBe(false);
  });

  it("rejects duplicate ids", () => {
    expect(ok([node("a", null), node("a", null)])).toBe(false);
  });

  it("caps the number of nodes", () => {
    const under = Array.from({ length: MAX_NODES }, (_, i) => node(`n${i}`, null));
    expect(ok(under)).toBe(true);
    expect(ok([...under, node("one-too-many", null)])).toBe(false);
  });

  it("caps free text so one node can't carry a novel", () => {
    expect(ok([node("a", null, { note: "x".repeat(2_001) })])).toBe(false);
    expect(ok([node("a", null, { label: "x".repeat(201) })])).toBe(false);
  });

  it("rejects a status or origin outside the known set", () => {
    expect(ok([node("a", null, { status: "problem" })])).toBe(true);
    expect(
      ok([node("a", null, { status: "definitely-broken" as FrameworkNodePayload["status"] })]),
    ).toBe(false);
    expect(
      ok([node("a", null, { origin: "smuggled" as FrameworkNodePayload["origin"] })]),
    ).toBe(false);
  });

  // The client sends `undefined` for absent optionals; the action maps them to
  // null on the way to Prisma. Both spellings have to survive validation.
  it("accepts undefined and null alike for optional fields", () => {
    expect(ok([node("a", null, { value: undefined, note: null, origin: undefined })])).toBe(true);
  });
});

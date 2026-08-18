import { describe, expect, it, vi } from "vitest";

// `prefillLevel` is pure, but it ships in the module that also reads the
// database. Only the client is stubbed; the rule itself is the real one.
//
// This suite used to live in `tests/colleges.test.ts` and outlived it: the
// curated college list went when the app became single-campus, and these cases
// are about the library's target-level prefill, which did not.
vi.mock("@/lib/db", () => ({ db: { profile: { findUnique: vi.fn() } } }));
const { prefillLevel } = await import("@/lib/profile");

describe("prefillLevel", () => {
  it("applies the level when the candidate has exactly one target", () => {
    expect(prefillLevel(["McKinsey"], {})).toBe("McKinsey");
  });

  /**
   * `?level=` holds one value and the filter is a single select, so several
   * targets have no URL that expresses them. Picking one would show a third of
   * what they asked for while claiming to have applied their goals.
   */
  it("applies nothing when several targets are set, because the filter holds one", () => {
    expect(prefillLevel(["McKinsey", "BCG"], {})).toBeNull();
  });

  it("applies nothing when no targets are set", () => {
    expect(prefillLevel([], {})).toBeNull();
  });

  it("leaves a library the visitor already filtered alone", () => {
    expect(prefillLevel(["McKinsey"], { level: "BCG" })).toBeNull();
    expect(prefillLevel(["McKinsey"], { type: "simulation" })).toBeNull();
    expect(prefillLevel(["McKinsey"], { category: "retail" })).toBeNull();
    expect(prefillLevel(["McKinsey"], { difficulty: "Easy" })).toBeNull();
  });

  it("leaves a search alone", () => {
    expect(prefillLevel(["McKinsey"], { q: "chai" })).toBeNull();
  });

  it("leaves someone bounced off a locked question alone", () => {
    // Arriving on ?wall=locked means the page is already saying something; a
    // filter appearing at the same moment reads as the lock having hidden things.
    expect(prefillLevel(["McKinsey"], { wall: "locked" })).toBeNull();
  });
});

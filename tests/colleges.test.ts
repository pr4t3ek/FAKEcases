import { describe, expect, it, vi } from "vitest";
import {
  COLLEGES,
  COLLEGE_KINDS,
  COLLEGE_OTHER,
  collegeById,
  collegesByKind,
  isKnownCollege,
} from "@/lib/config/colleges";

// `prefillLevel` is pure, but it ships in the module that also reads the
// database. Only the client is stubbed; the rule itself is the real one.
vi.mock("@/lib/db", () => ({ db: { profile: { findUnique: vi.fn() } } }));
const { prefillLevel } = await import("@/lib/profile");

describe("COLLEGES", () => {
  it("gives every institution a unique id", () => {
    const ids = COLLEGES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /**
   * The id is a stored grouping key, not a label. A rename silently regroups
   * everyone already on it, and a capitalised or spaced id is one typo away
   * from becoming a second cohort.
   */
  it("uses lowercase hyphenated ids, because the id is a stored grouping key", () => {
    for (const c of COLLEGES) {
      expect(c.id, c.name).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("keeps the reserved Other sentinel out of the list", () => {
    expect(COLLEGES.some((c) => c.id === COLLEGE_OTHER)).toBe(false);
    expect(isKnownCollege(COLLEGE_OTHER)).toBe(false);
  });

  it("gives every institution a kind the grouped select can render", () => {
    for (const c of COLLEGES) {
      expect(COLLEGE_KINDS, c.name).toContain(c.kind);
    }
  });

  it("names a city for every institution", () => {
    for (const c of COLLEGES) expect(c.city.length, c.name).toBeGreaterThan(0);
  });
});

describe("collegeById", () => {
  it("finds a curated institution", () => {
    expect(collegeById("iim-bangalore")?.name).toBe("IIM Bangalore");
  });

  it("returns nothing for an unknown id rather than throwing", () => {
    // A stored id can outlive a list entry; a profile should still render.
    expect(collegeById("iim-atlantis")).toBeUndefined();
    expect(collegeById(null)).toBeUndefined();
  });
});

describe("collegesByKind", () => {
  it("accounts for every institution exactly once", () => {
    const grouped = collegesByKind().flatMap((g) => g.colleges);
    expect(grouped).toHaveLength(COLLEGES.length);
  });

  it("emits groups in COLLEGE_KINDS order, so the select is stable", () => {
    const kinds = collegesByKind().map((g) => g.kind);
    expect(kinds).toEqual([...COLLEGE_KINDS].filter((k) => kinds.includes(k)));
  });
});

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

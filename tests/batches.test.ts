import { describe, expect, it } from "vitest";
import {
  BATCHES,
  BATCH_IDS,
  batchById,
  batchLabel,
  batchOptionLabel,
  isKnownBatch,
} from "@/lib/config/batches";

/**
 * The batch vocabulary, tested the way `colleges.test.ts` tests its own: the id
 * is a stored grouping key, so what matters is that it is stable, unique and
 * never confused with the label a screen prints.
 */
describe("BATCHES", () => {
  it("offers exactly the two PGP years", () => {
    expect(BATCHES.map((b) => b.id)).toEqual(["pgp1", "pgp2"]);
  });

  it("gives every batch a unique id", () => {
    const ids = BATCHES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses lowercase ids, because the id is what a row stores", () => {
    for (const b of BATCHES) {
      expect(b.id, b.label).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("keeps BATCH_IDS in step with the list the form renders", () => {
    expect([...BATCH_IDS]).toEqual(BATCHES.map((b) => b.id));
  });

  /**
   * The years are display text and the id is not derived from them, which is the
   * property that lets a batch roll over without orphaning anyone: next year's
   * edit is to `years`, never to `id`.
   */
  it("keeps the graduating year out of the id", () => {
    for (const b of BATCHES) {
      expect(b.id).not.toMatch(/\d{4}/);
      expect(b.years).toMatch(/^\d{4}–\d{2}$/);
    }
  });
});

describe("batchById", () => {
  it("resolves a known id", () => {
    expect(batchById("pgp1")?.label).toBe("PGP-1");
    expect(batchById("pgp2")?.years).toBe("2025–27");
  });

  it("returns null for anything else, including nothing at all", () => {
    expect(batchById("pgp3")).toBeNull();
    expect(batchById("")).toBeNull();
    expect(batchById(null)).toBeNull();
    expect(batchById(undefined)).toBeNull();
  });

  it("agrees with isKnownBatch", () => {
    expect(isKnownBatch("pgp1")).toBe(true);
    expect(isKnownBatch("PGP-1")).toBe(false);
    expect(isKnownBatch(null)).toBe(false);
  });
});

describe("labels", () => {
  /**
   * A board row is width-constrained and sits beside a college name, so it gets
   * the bare label; the form is where the years disambiguate the two options.
   */
  it("prints the bare label on a board row and the years only in a form", () => {
    expect(batchLabel("pgp1")).toBe("PGP-1");
    expect(batchOptionLabel(BATCHES[0])).toBe("PGP-1 (2026–28)");
  });

  it("has nothing to print for an absent or unknown batch", () => {
    expect(batchLabel(null)).toBeNull();
    expect(batchLabel("pgp3")).toBeNull();
  });
});

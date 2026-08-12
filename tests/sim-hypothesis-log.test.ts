/**
 * The record of what was believed, and when.
 *
 * The log exists for two readers with very different tolerances. The debrief
 * wants a story and can survive a gap in it; `scoreInvestigation` wants the
 * truth about purchase *n* and must never be handed a guess. So the through-line
 * here is that every degraded case — no log, a corrupt blob, a run played
 * before any of this existed — falls back to the single current hypothesis and
 * therefore scores exactly as it did before the log was added.
 */

import { describe, expect, it } from "vitest";
import {
  appendRevision,
  hypothesisAtPurchase,
  parseHypothesisLog,
  wasRevised,
  withHypothesisLog,
  type HypothesisLog,
  type HypothesisRevision,
} from "@/lib/sim/hypothesis-log";

const revision = (over: Partial<HypothesisRevision> = {}): HypothesisRevision => ({
  causeIds: ["supply.riders"],
  note: null,
  afterPurchases: 0,
  afterDays: 0,
  at: "2026-01-01T00:00:00.000Z",
  ...over,
});

const logOf = (...revisions: HypothesisRevision[]): HypothesisLog => ({ revisions });

describe("parseHypothesisLog", () => {
  it("reads a log back out of the state blob", () => {
    const stored = withHypothesisLog(null, logOf(revision()));
    expect(parseHypothesisLog(stored).revisions).toHaveLength(1);
  });

  it("returns an empty log for a run that never had one", () => {
    expect(parseHypothesisLog(null).revisions).toEqual([]);
    expect(parseHypothesisLog("").revisions).toEqual([]);
  });

  it("returns an empty log rather than throwing on a corrupt blob", () => {
    // A run whose state cannot be read must still be scoreable. Degrading to
    // "no history" costs the debrief a paragraph; throwing would cost the
    // candidate their run.
    expect(parseHypothesisLog("{not json").revisions).toEqual([]);
    expect(parseHypothesisLog('{"hypothesisLog":{"revisions":"nope"}}').revisions).toEqual([]);
  });

  it("drops entries that are not revisions, and keeps the ones that are", () => {
    const stored = JSON.stringify({
      hypothesisLog: { revisions: [null, { note: "no causes" }, revision()] },
    });
    expect(parseHypothesisLog(stored).revisions).toHaveLength(1);
  });
});

describe("withHypothesisLog", () => {
  it("keeps whatever else the state blob was carrying", () => {
    // `stateJson` is one column shared by every format. A war room that grows
    // a period schedule later must find it still there.
    const existing = JSON.stringify({ schedule: [[{ interventionId: "iv-a" }]] });
    const merged = JSON.parse(withHypothesisLog(existing, logOf(revision())));
    expect(merged.schedule).toHaveLength(1);
    expect(merged.hypothesisLog.revisions).toHaveLength(1);
  });

  it("starts fresh rather than refusing the write when the blob is unreadable", () => {
    const merged = JSON.parse(withHypothesisLog("{broken", logOf(revision())));
    expect(merged.hypothesisLog.revisions).toHaveLength(1);
  });
});

describe("appendRevision", () => {
  it("does not mutate the log it was given", () => {
    const before = logOf(revision());
    const after = appendRevision(before, revision({ afterPurchases: 2 }));
    expect(before.revisions).toHaveLength(1);
    expect(after.revisions).toHaveLength(2);
  });
});

describe("hypothesisAtPurchase", () => {
  const current = ["demand.price"];

  it("returns the belief that was standing when the pull was bought", () => {
    const log = logOf(
      revision({ causeIds: ["supply.riders"], afterPurchases: 0 }),
      revision({ causeIds: ["product.checkout"], afterPurchases: 2 }),
    );
    // seq is 1-based: purchases 1 and 2 were made under the opening call…
    expect(hypothesisAtPurchase(log, 1, current)).toEqual(["supply.riders"]);
    expect(hypothesisAtPurchase(log, 2, current)).toEqual(["supply.riders"]);
    // …and the third was the first bought under the revised one.
    expect(hypothesisAtPurchase(log, 3, current)).toEqual(["product.checkout"]);
  });

  it("falls back to the current hypothesis when there is no history", () => {
    // Every run played before the log existed takes this path, and must score
    // exactly as it did then.
    expect(hypothesisAtPurchase({ revisions: [] }, 1, current)).toEqual(current);
  });

  it("falls back when nothing was recorded early enough", () => {
    const log = logOf(revision({ causeIds: ["supply.riders"], afterPurchases: 5 }));
    expect(hypothesisAtPurchase(log, 1, current)).toEqual(current);
  });
});

describe("wasRevised", () => {
  it("is false for a run that named one thing and stuck to it", () => {
    expect(wasRevised(logOf(revision()))).toBe(false);
    expect(wasRevised({ revisions: [] })).toBe(false);
  });

  it("is true once the candidate has changed their mind", () => {
    expect(wasRevised(logOf(revision(), revision({ afterPurchases: 1 })))).toBe(true);
  });
});

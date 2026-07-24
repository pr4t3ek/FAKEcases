import { describe, it, expect } from "vitest";
import {
  levelForXp,
  xpForLevel,
  computeSkillRating,
  rankForPercentile,
  rankPlacementAttempts,
} from "@/lib/config";
import { computeAttemptXp } from "@/lib/gamification";

describe("levels", () => {
  it("level increases with xp and is monotonic", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(100000)).toBeGreaterThan(levelForXp(500));
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(3)).toBeGreaterThan(xpForLevel(2));
  });
});

describe("computeAttemptXp", () => {
  it("rewards higher scores and no-hint runs", () => {
    const low = computeAttemptXp({ overall: 40, hintsUsed: 3, isFirstToday: false });
    const high = computeAttemptXp({ overall: 90, hintsUsed: 0, isFirstToday: false });
    expect(high).toBeGreaterThan(low);
  });
});

describe("skill rating + percentile rank", () => {
  it("returns null rating with no scores", () => {
    expect(computeSkillRating([])).toBeNull();
  });

  it("weights recent scores and rewards consistency", () => {
    const improving = computeSkillRating([50, 60, 70, 90])!;
    const flat = computeSkillRating([65, 65, 65, 65])!;
    expect(improving).toBeGreaterThan(0);
    expect(flat).toBeGreaterThan(60); // consistency bonus keeps it healthy
  });

  it("maps percentiles to the right rank bands", () => {
    const enough = rankPlacementAttempts;
    expect(rankForPercentile(95, enough)).toBe("Diamond");
    expect(rankForPercentile(80, enough)).toBe("Platinum");
    expect(rankForPercentile(55, enough)).toBe("Gold");
    expect(rankForPercentile(20, enough)).toBe("Silver");
  });

  it("stays Unranked during placement", () => {
    expect(rankForPercentile(99, rankPlacementAttempts - 1)).toBe("Unranked");
    expect(rankForPercentile(null, 100)).toBe("Unranked");
  });
});

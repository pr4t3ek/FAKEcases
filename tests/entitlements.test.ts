import { describe, expect, it } from "vitest";
import { tierAccess, guestSampleSize, ACCESS_TIERS } from "@/lib/config";
import {
  canOpen,
  isLocked,
  tierFor,
  upgradeFor,
  wallRedirect,
  WALL_LOCKED,
  WALL_PARAM,
} from "@/lib/entitlements";
import { questions as seedQuestions } from "@/prisma/seed-data";
import {
  answerModeFor,
  isSimulation,
  PRACTICE_TYPES,
  PRACTISABLE_TYPES,
} from "@/lib/types";

const free = { freeTier: true };
const paid = { freeTier: false };

const NOW = new Date("2026-08-06T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const inDays = (n: number) => new Date(NOW.getTime() + n * DAY);

describe("tierFor", () => {
  it("places a guest row in the guest tier", () => {
    expect(tierFor({ isGuest: true, proUntil: null }, NOW)).toBe("guest");
  });

  it("places a registered account with no pass in the free tier", () => {
    expect(tierFor({ isGuest: false, proUntil: null }, NOW)).toBe("free");
  });

  it("places an account with a live pass in the pro tier", () => {
    expect(tierFor({ isGuest: false, proUntil: inDays(10) }, NOW)).toBe("pro");
  });

  /**
   * The behaviour that replaces a scheduled job. A pass that ran out is simply
   * not greater than now, so the account is back on the free tier without
   * anything having run and without a stored label to fall out of date.
   */
  it("drops an expired pass back to free with no job having run", () => {
    expect(tierFor({ isGuest: false, proUntil: inDays(-1) }, NOW)).toBe("free");
  });

  it("treats a pass expiring exactly now as over", () => {
    expect(tierFor({ isGuest: false, proUntil: NOW }, NOW)).toBe("free");
  });

  it("reads the tier as of the moment it is asked", () => {
    // The same row is pro before its expiry and free after it, with nothing
    // written in between.
    const user = { isGuest: false, proUntil: inDays(5) };
    expect(tierFor(user, inDays(4))).toBe("pro");
    expect(tierFor(user, inDays(6))).toBe("free");
  });

  it("treats no session as a guest, not as an error", () => {
    // A first-time visitor has no User row until they act. Anything else here
    // makes the library render one set of locks before the first click and a
    // different set after it.
    expect(tierFor(null, NOW)).toBe("guest");
    expect(tierFor(undefined, NOW)).toBe("guest");
  });

  it("keeps a guest a guest even if the row somehow carries a live pass", () => {
    // A guest row is absorbed or deleted at signup, so this should never exist
    // — but it must not be a way past the gate if it ever does.
    expect(tierFor({ isGuest: true, proUntil: inDays(30) }, NOW)).toBe("guest");
  });

  it("defaults to the real clock when no time is given", () => {
    expect(tierFor({ isGuest: false, proUntil: new Date(Date.now() + DAY) })).toBe("pro");
    expect(tierFor({ isGuest: false, proUntil: new Date(Date.now() - DAY) })).toBe("free");
  });
});

describe("canOpen", () => {
  it("gives a guest the flagged content and nothing else", () => {
    expect(canOpen("guest", free)).toBe(true);
    expect(canOpen("guest", paid)).toBe(false);
  });

  it("holds the paid set back from a free account", () => {
    expect(canOpen("free", free)).toBe(true);
    expect(canOpen("free", paid)).toBe(false);
  });

  it("gives a Pro account everything", () => {
    expect(canOpen("pro", free)).toBe(true);
    expect(canOpen("pro", paid)).toBe(true);
  });

  it("never locks a flagged question for any tier", () => {
    for (const tier of ACCESS_TIERS) expect(canOpen(tier, free)).toBe(true);
  });

  it("isLocked is exactly the inverse", () => {
    for (const tier of ACCESS_TIERS) {
      for (const q of [free, paid]) {
        expect(isLocked(tier, q)).toBe(!canOpen(tier, q));
      }
    }
  });
});

describe("upgradeFor", () => {
  it("sends a guest to sign up", () => {
    expect(upgradeFor("guest")?.href).toBe("/signup");
  });

  it("sends a free account somewhere different from a guest", () => {
    // Both tiers are blocked now, but not by the same thing, so they must not
    // be told the same thing: a guest needs an account, a free account needs a
    // pass.
    expect(upgradeFor("free")).not.toBeNull();
    expect(upgradeFor("free")?.href).not.toBe(upgradeFor("guest")?.href);
  });

  it("offers nothing to Pro, the one tier that is never blocked", () => {
    // Otherwise the UI would render an upgrade CTA on a card that is already
    // open, to someone who has already paid.
    expect(upgradeFor("pro")).toBeNull();
  });

  it("every restricted tier has somewhere to send a blocked user", () => {
    for (const tier of ACCESS_TIERS) {
      if (tierAccess[tier].content === "all") continue;
      const upgrade = upgradeFor(tier);
      expect(upgrade, `${tier} blocks content with no upgrade path`).not.toBeNull();
      expect(upgrade?.cta.length).toBeGreaterThan(0);
      expect(upgrade?.reason.length).toBeGreaterThan(0);
    }
  });
});

describe("wallRedirect", () => {
  it("lands on the library with the banner raised", () => {
    // Not /signup: a bare signup form with no explanation reads as a bug, and
    // the free items should still be on the page.
    expect(wallRedirect()).toBe(`/library?${WALL_PARAM}=${WALL_LOCKED}`);
  });

  it("sends a refused war room back to the war rooms, not the library", () => {
    // The library no longer lists simulations, so the old behaviour would bounce
    // someone to a page with no trace of what they just tried to open — and the
    // one free war room, sitting there to be played instead, nowhere in sight.
    expect(wallRedirect("simulation")).toBe(`/simulations?${WALL_PARAM}=${WALL_LOCKED}`);
  });
});

describe("PRACTICE_TYPES", () => {
  it("is the practisable formats minus simulations", () => {
    expect(PRACTICE_TYPES).toEqual(["guesstimate", "qualitative"]);
  });

  it("never contains a simulation", () => {
    // Derived from PRACTISABLE_TYPES rather than written out again, so a new
    // format added there cannot silently skip the library. This is the assertion
    // that catches a war room leaking back into the practice catalogue or the
    // dashboard's recommendation strip.
    expect(PRACTICE_TYPES.some(isSimulation)).toBe(false);
    for (const type of PRACTISABLE_TYPES) {
      expect(PRACTICE_TYPES.includes(type) || isSimulation(type)).toBe(true);
    }
  });
});

describe("the seeded shop window", () => {
  const practisable = seedQuestions.filter((q) => (q.type ?? "guesstimate") !== "case");
  const flagged = practisable.filter((q) => q.freeTier);

  function kindOf(q: { type?: string }): "simulation" | "qualitative" | "guesstimate" {
    if (isSimulation(q.type ?? "guesstimate")) return "simulation";
    return answerModeFor(q.type ?? "guesstimate") === "qualitative"
      ? "qualitative"
      : "guesstimate";
  }

  it("opens exactly the intended number of each kind to a guest", () => {
    for (const [kind, expected] of Object.entries(guestSampleSize)) {
      expect(flagged.filter((q) => kindOf(q) === kind), kind).toHaveLength(expected);
    }
  });

  it("flags nothing outside the three kinds the guest tier covers", () => {
    expect(flagged).toHaveLength(
      Object.values(guestSampleSize).reduce((a, b) => a + b, 0),
    );
  });

  it("leaves a guest something to do in every format", () => {
    // The failure this guards against is a seed edit that locks the library
    // completely: "Start practising" on the landing page would then lead to a
    // page of locked cards.
    for (const kind of Object.keys(guestSampleSize)) {
      expect(flagged.some((q) => kindOf(q) === kind), kind).toBe(true);
    }
  });

  it("gives the guest a case that can actually score Diagnosis", () => {
    // A case with no declared rootCause works, but scores nothing on the
    // dimension the format exists to teach — a poor advertisement for it.
    const guestCase = flagged.find((q) => kindOf(q) === "qualitative");
    expect(guestCase?.rootCause).toBeTruthy();
  });

  it("gives the guest an Easy simulation", () => {
    // The hard scenarios withhold their metric map on purpose. Meeting one cold
    // as your first contact with the format is the wrong first impression.
    const guestSim = flagged.find((q) => kindOf(q) === "simulation");
    expect(guestSim?.difficulty).toBe("Easy");
  });
});

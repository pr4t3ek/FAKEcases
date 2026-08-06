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
import { answerModeFor, isSimulation } from "@/lib/types";

const free = { freeTier: true };
const paid = { freeTier: false };

describe("tierFor", () => {
  it("places a guest row in the guest tier", () => {
    expect(tierFor({ isGuest: true, plan: "free" })).toBe("guest");
  });

  it("places a registered free account in the free tier", () => {
    expect(tierFor({ isGuest: false, plan: "free" })).toBe("free");
  });

  it("places a pro account in the pro tier", () => {
    expect(tierFor({ isGuest: false, plan: "pro" })).toBe("pro");
  });

  it("treats no session as a guest, not as an error", () => {
    // A first-time visitor has no User row until they act. Anything else here
    // makes the library render one set of locks before the first click and a
    // different set after it.
    expect(tierFor(null)).toBe("guest");
    expect(tierFor(undefined)).toBe("guest");
  });

  it("ignores a plan value it doesn't recognise rather than upgrading on it", () => {
    expect(tierFor({ isGuest: false, plan: "enterprise" })).toBe("free");
    expect(tierFor({ isGuest: false, plan: "" })).toBe("free");
  });

  it("keeps a guest a guest even if the row somehow carries a paid plan", () => {
    // Nothing writes this today, but a guest row with plan: "pro" must not be
    // a way past the gate.
    expect(tierFor({ isGuest: true, plan: "pro" })).toBe("guest");
  });
});

describe("canOpen", () => {
  it("gives a guest the flagged content and nothing else", () => {
    expect(canOpen("guest", free)).toBe(true);
    expect(canOpen("guest", paid)).toBe(false);
  });

  it("gives a registered account everything today", () => {
    expect(canOpen("free", paid)).toBe(true);
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
  it("offers a guest a way through", () => {
    expect(upgradeFor("guest")?.href).toBe("/signup");
  });

  it("offers nothing to a tier that is never blocked", () => {
    // Otherwise the UI would render an upgrade CTA on a card that is already
    // open, which is how a free tier starts looking like a paywall.
    expect(upgradeFor("free")).toBeNull();
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

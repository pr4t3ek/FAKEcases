import { describe, expect, it } from "vitest";
import { tierAccess, guestSampleSize, ACCESS_TIERS } from "@/lib/config";
import {
  canOpen,
  isLocked,
  tierFor,
  upgradeFor,
  wallRedirect,
  NO_GRANT,
  WALL_LOCKED,
  WALL_PARAM,
} from "@/lib/entitlements";
import { questions as seedQuestions } from "@/prisma/seed-data";
import { listScenarios } from "@/lib/sim/registry";
import { listSimulators } from "@/lib/sim/configs/registry";
import {
  answerModeFor,
  isSimulation,
  PRACTICE_TYPES,
  PRACTISABLE_TYPES,
} from "@/lib/types";

const free = { id: "q-free", freeTier: true };
const paid = { id: "q-paid", freeTier: false };
/** A second locked question, for proving a grant opens one thing and not the rest. */
const otherPaid = { id: "q-other", freeTier: false };

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

/**
 * The classroom escape hatch.
 *
 * A grant is what lets a professor put a locked war room in front of sixty
 * students who have no pass between them, WITHOUT handing them the catalogue.
 * That second half is the part worth testing: the failure mode this feature
 * could have had is a membership quietly becoming a Pro pass.
 */
describe("canOpen with an access grant", () => {
  const grant = { questionIds: [paid.id] };

  it("opens the granted question to a guest — the whole point of the feature", () => {
    expect(canOpen("guest", paid)).toBe(false);
    expect(canOpen("guest", paid, grant)).toBe(true);
  });

  it("opens it to a free account too", () => {
    expect(canOpen("free", paid, grant)).toBe(true);
  });

  it("opens the granted question and NOTHING else", () => {
    // The containment property. If this ever fails, a room has become a Pro
    // pass and the paid catalogue is being given away one class at a time.
    expect(canOpen("guest", otherPaid, grant)).toBe(false);
    expect(canOpen("free", otherPaid, grant)).toBe(false);
  });

  it("leaves the tier alone", () => {
    // A grant is not an upgrade. The student is still a guest, so the signup
    // path they are owed everywhere else in the app is unchanged.
    const student = { isGuest: true, proUntil: null };
    expect(tierFor(student, NOW)).toBe("guest");
    expect(upgradeFor(tierFor(student, NOW))?.href).toBe("/signup");
  });

  it("an empty grant is exactly today's behaviour, for every tier", () => {
    for (const tier of ACCESS_TIERS) {
      for (const q of [free, paid, otherPaid]) {
        expect(canOpen(tier, q, NO_GRANT)).toBe(canOpen(tier, q));
        expect(canOpen(tier, q, { questionIds: [] })).toBe(canOpen(tier, q));
      }
    }
  });

  it("is a no-op on a question that was already free", () => {
    expect(canOpen("guest", free, { questionIds: [free.id] })).toBe(true);
    expect(canOpen("guest", free)).toBe(true);
  });

  it("changes nothing for Pro, who already had everything", () => {
    expect(canOpen("pro", paid, grant)).toBe(true);
    expect(canOpen("pro", otherPaid, grant)).toBe(true);
  });

  it("isLocked stays the exact inverse with a grant in play", () => {
    for (const tier of ACCESS_TIERS) {
      for (const q of [free, paid, otherPaid]) {
        expect(isLocked(tier, q, grant)).toBe(!canOpen(tier, q, grant));
      }
    }
  });

  it("matches on the id, not on the object", () => {
    // The grant crosses a serialisation boundary — it is derived on the server
    // from membership rows and compared against a question read separately —
    // so identity matching would work in a test and fail in the app.
    expect(canOpen("guest", { id: paid.id, freeTier: false }, grant)).toBe(true);
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

describe("the Pro pitch names the catalogue it is selling", () => {
  // The counts in the copy are prose, so nothing made them follow the content.
  // They didn't: the sentence promised "9 war rooms" from the day the three
  // finance scenarios shipped until this test was written, under-selling the
  // product on the one screen where someone decides whether to pay for it.
  const kindOf = (q: (typeof seedQuestions)[number]) => q.type ?? "guesstimate";
  const counts = {
    guesstimate: seedQuestions.filter((q) => kindOf(q) === "guesstimate").length,
    qualitative: seedQuestions.filter((q) => kindOf(q) === "qualitative").length,
    simulation: seedQuestions.filter((q) => kindOf(q) === "simulation").length,
  };

  const reason = tierAccess.free.upgrade?.reason ?? "";

  it("quotes the real number of guesstimates and war rooms", () => {
    expect(reason).toContain(`${counts.guesstimate} guesstimates`);
    expect(reason).toContain(`${counts.simulation} war rooms`);
  });

  it("quotes the real number of cases", () => {
    // The third format, unpinned until the confusion-matrix case landed — and
    // duly wrong the moment it did, because the sentence said "both cases" while
    // there were three. Asserting the numeral is also what keeps the copy from
    // going back to a word: "both" cannot be checked against a count.
    expect(reason).toContain(`${counts.qualitative} cases`);
  });

  it("counts a war room once, in the catalogue and in the registries alike", () => {
    // A seed row without an exercise behind it is inert, and an exercise without
    // a row is unreachable. The pitch is only honest if the two agree, so it is
    // pinned to both rather than to whichever was convenient.
    //
    // BOTH registries: authored scenarios live in lib/sim/registry, and
    // config-driven simulators in lib/sim/configs/registry. Checking only the
    // first is what this assertion did before the buyback simulator existed, and
    // it failed the moment a catalogue row pointed at the second.
    expect(counts.simulation).toBe(listScenarios().length + listSimulators().length);
  });

  it("says nothing about a tier that is never blocked", () => {
    // Pro has no upgrade path, so there is no count to keep true for it.
    expect(tierAccess.pro.upgrade).toBeNull();
  });
});

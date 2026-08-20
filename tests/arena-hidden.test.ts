import { describe, expect, it } from "vitest";
import { FIRM_INDICES, firmKey, mandiConfig } from "@/lib/sim/configs/mandi";
import { buildBoard } from "@/lib/arena/payload";
import { dealPersonas } from "@/lib/arena/personas";
import { namespaceDecision, replayMatch, stepMatch } from "@/lib/arena/run";
import { specialise, toSeatViews, type MatchConfig } from "@/lib/arena/setup";
import { ARENA_SEATS } from "@/lib/arena/types";

/**
 * What must not cross to the browser.
 *
 * Asserted against the SERIALISED payload rather than against the builder,
 * exactly as `tests/sim-redact.test.ts` does — the question is not "did we mean
 * to withhold this" but "is it in the bytes that ship". A field added to the
 * model tomorrow is caught by this only if the assertion reads the JSON, so it
 * reads the JSON.
 */
function board(seed = "hide-1", quarters = 3) {
  const personas = dealPersonas(seed, ARENA_SEATS);
  const specs = Array.from({ length: ARENA_SEATS }, (_, seatIndex) => ({
    seatIndex,
    userId: seatIndex === 0 ? "me" : null,
    personaId: personas[seatIndex],
  }));
  const config = specialise({ gameSlug: "mandi", seed, seats: specs }) as MatchConfig;

  let state = replayMatch({ config, seed, journal: null });
  for (let q = 0; q < quarters; q++) {
    state = stepMatch(
      state,
      namespaceDecision(0, { price: 76, marketing: 1_200, stores: 1, promise: 20 }),
      config,
    );
  }

  const names = Object.fromEntries(specs.map((s) => [s.seatIndex, `Firm ${s.seatIndex}`]));
  return buildBoard({
    matchId: "m1",
    config,
    state,
    seats: toSeatViews(specs, names),
    yourSeat: 0,
    mode: "solo",
    status: "running",
    code: null,
    isHost: true,
    committed: false,
    waitingOn: [],
    roundEndsAt: null,
  });
}

describe("the live board", () => {
  const json = JSON.stringify(board());

  it("never ships the regime", () => {
    // The single thing the whole game is about reading.
    expect(json).not.toContain("regime");
    expect(json).not.toContain("openingRegime");
  });

  it("never ships the size of the pie", () => {
    // `marketPotential` carries the regime's demand multiplier almost
    // undisguised, so shipping it would hand over the regime by another name.
    expect(json).not.toContain("marketPotential");
    expect(json).not.toContain("marketSized");
    expect(json).not.toContain("marketAttract");
  });

  it("never ships a rival's state of mind", () => {
    for (const seat of FIRM_INDICES) expect(json).not.toContain(`peace${seat}`);
    expect(json).not.toContain("calm");
    expect(json).not.toContain("aggression");
  });

  it("never ships a rival's capacity or reputation", () => {
    const data = board();
    for (const firm of data.firms) {
      if (firm.isYou) continue;
      expect(firm.capacity).toBeNull();
      expect(firm.reputation).toBeNull();
    }
  });

  it("does ship your own capacity and reputation", () => {
    // The other half of the rule. A player who cannot see their own position is
    // not being challenged, they are being hidden from.
    const you = board().firms.find((f) => f.isYou)!;
    expect(you.capacity).toBeGreaterThan(0);
    expect(you.reputation).toBeGreaterThan(0);
  });

  it("does ship every firm's price, orders and share", () => {
    // Public by design: a market where you cannot see what competitors charge
    // is not a market.
    for (const firm of board().firms) {
      expect(firm.price).toBeGreaterThan(0);
      expect(firm.share).toBeGreaterThanOrEqual(0);
    }
  });

  it("ships not one of the keys the config declares hidden", () => {
    // The strongest single statement, and the one that will catch a leak added
    // next year: whatever `hiddenKeys` names must not appear anywhere in the
    // bytes, under any nesting.
    //
    // Deliberately checked against `hiddenKeys` rather than against every state
    // key. Some public fields legitimately share a name with a state key —
    // `marketServed` is the city's order volume and belongs on the board — so a
    // blanket assertion would be pinning the wrong thing and would fail the day
    // somebody renders a number they are entitled to.
    for (const key of mandiConfig.hiddenKeys) {
      expect(json.includes(key), `${key} leaked into the payload`).toBe(false);
    }
    expect(mandiConfig.hiddenKeys.length).toBeGreaterThan(10);
  });

  it("hands over the rivals' objectives only at the debrief", () => {
    // `objective` is a `DebriefSeat` field and has no counterpart on the board.
    expect(json).not.toContain("objective");
  });

  it("drops the opening position from the charted series", () => {
    // `history[k][0]` is "before anything happened". Charting it would show a
    // quarter that was never played.
    const data = board("hide-1", 3);
    expect(data.marketServed).toHaveLength(3);
    expect(data.yourShare).toHaveLength(3);
  });
});

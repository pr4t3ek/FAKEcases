import { describe, expect, it } from "vitest";
import { intersects, placeCard, type Rect } from "@/lib/tour-placement";

const CARD = { width: 360, height: 280 };
const DESKTOP = { width: 1440, height: 800 };

function cardRect(p: { left: number; top: number }): Rect {
  return { left: p.left, top: p.top, width: CARD.width, height: CARD.height };
}

describe("tutorial card placement", () => {
  /**
   * The reported bug, as a test.
   *
   * The framework panel on a laptop: tall enough that the card fits neither
   * above nor below it. The old code pinned the card to the bottom of the
   * viewport and it landed across the lower third of the tree — during exactly
   * the steps that draw a demo tree, since all six point at this element.
   */
  const framework: Rect = { left: 16, top: 60, width: 620, height: 640 };

  it("does not cover a target too tall to sit above or below", () => {
    const placed = placeCard({ target: framework, card: CARD, viewport: DESKTOP });
    expect(intersects(cardRect(placed), framework)).toBe(false);
  });

  it("puts it beside that target rather than over it", () => {
    const placed = placeCard({ target: framework, card: CARD, viewport: DESKTOP });
    expect(placed.side).toBe("right");
    expect(placed.left).toBeGreaterThanOrEqual(framework.left + framework.width);
  });

  it("keeps it on screen while doing so", () => {
    const placed = placeCard({ target: framework, card: CARD, viewport: DESKTOP });
    expect(placed.top).toBeGreaterThanOrEqual(0);
    expect(placed.top + CARD.height).toBeLessThanOrEqual(DESKTOP.height);
    expect(placed.left + CARD.width).toBeLessThanOrEqual(DESKTOP.width);
  });

  it("goes left when the target is against the right edge", () => {
    const rightHand: Rect = { left: 1000, top: 60, width: 420, height: 640 };
    const placed = placeCard({ target: rightHand, card: CARD, viewport: DESKTOP });
    expect(placed.side).toBe("left");
    expect(intersects(cardRect(placed), rightHand)).toBe(false);
  });

  describe("the ordinary cases still behave", () => {
    it("sits below a short target near the top", () => {
      const header: Rect = { left: 400, top: 40, width: 300, height: 48 };
      const placed = placeCard({ target: header, card: CARD, viewport: DESKTOP });
      expect(placed.side).toBe("below");
      expect(placed.top).toBe(header.top + header.height + 12);
      expect(intersects(cardRect(placed), header)).toBe(false);
    });

    it("flips above a short target near the bottom", () => {
      const footer: Rect = { left: 400, top: 700, width: 300, height: 48 };
      const placed = placeCard({ target: footer, card: CARD, viewport: DESKTOP });
      expect(placed.side).toBe("above");
      expect(intersects(cardRect(placed), footer)).toBe(false);
    });

    it("centres horizontally on the target when placed above or below", () => {
      const header: Rect = { left: 400, top: 40, width: 300, height: 48 };
      const placed = placeCard({ target: header, card: CARD, viewport: DESKTOP });
      expect(placed.left + CARD.width / 2).toBeCloseTo(header.left + header.width / 2, 0);
    });

    it("never runs off the left edge for a target hard against it", () => {
      const edge: Rect = { left: 0, top: 40, width: 120, height: 48 };
      const placed = placeCard({ target: edge, card: CARD, viewport: DESKTOP });
      expect(placed.left).toBeGreaterThanOrEqual(0);
    });
  });

  describe("phones, where there may be nowhere to go", () => {
    const PHONE = { width: 390, height: 700 };

    it("clamps into view rather than rendering off-screen", () => {
      // Taller than the space above and below, and too wide to sit beside.
      const tall: Rect = { left: 8, top: 50, width: 374, height: 600 };
      const placed = placeCard({ target: tall, card: CARD, viewport: PHONE });
      expect(placed.side).toBe("clamped");
      expect(placed.left).toBeGreaterThanOrEqual(0);
      expect(placed.top).toBeGreaterThanOrEqual(0);
      expect(placed.left + CARD.width).toBeLessThanOrEqual(PHONE.width);
      expect(placed.top + CARD.height).toBeLessThanOrEqual(PHONE.height);
    });

    it("still prefers below when a short target leaves room", () => {
      const short: Rect = { left: 8, top: 60, width: 374, height: 60 };
      const placed = placeCard({ target: short, card: CARD, viewport: PHONE });
      expect(placed.side).toBe("below");
      expect(intersects(cardRect(placed), short)).toBe(false);
    });
  });

  it("never overlaps unless it had to clamp", () => {
    // A sweep, because the failure was one specific geometry nobody thought to
    // check by hand. Any placement that reports a side other than "clamped" is
    // claiming it found clear space, and must actually have found it.
    for (let top = 0; top < 700; top += 37) {
      for (let height = 40; height < 700; height += 53) {
        for (let left = 0; left < 1200; left += 131) {
          const target: Rect = { left, top, width: 420, height };
          const placed = placeCard({ target, card: CARD, viewport: DESKTOP });
          if (placed.side === "clamped") continue;
          expect(
            intersects(cardRect(placed), target),
            `${placed.side} placement overlapped target at ${left},${top} ${420}x${height}`,
          ).toBe(false);
        }
      }
    }
  });
});

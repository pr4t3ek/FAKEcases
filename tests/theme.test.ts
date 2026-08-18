import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The theme, tested as text.
 *
 * A palette rewrite fails quietly: a token Tailwind maps but the CSS no longer
 * defines resolves to nothing, and `hsl()` with an empty variable renders as
 * transparent — an invisible border or a card that is suddenly the page colour.
 * Nothing typechecks that, and nothing in the app throws, so it is worth the
 * twenty lines here.
 */
const css = readFileSync(resolve(__dirname, "../app/globals.css"), "utf8");
const config = readFileSync(resolve(__dirname, "../tailwind.config.ts"), "utf8");

/** Every `hsl(var(--x))` the Tailwind colour map reads. */
const mapped = [...config.matchAll(/hsl\(var\((--[a-z-]+)\)\)/g)].map((m) => m[1]);

/** The `:root` block, without the print override that follows it. */
const rootBlock = css.slice(css.indexOf(":root {"), css.indexOf("@media print"));

describe("the palette", () => {
  it("defines every token Tailwind maps to a colour", () => {
    expect(mapped.length).toBeGreaterThan(10);
    for (const token of mapped) {
      expect(rootBlock, token).toContain(`${token}:`);
    }
  });

  /**
   * There is one theme now. A `.dark` block left behind would be a second
   * palette nobody edits, drifting until the day someone puts the toggle back
   * and finds last year's colours under it.
   */
  it("carries exactly one palette, with no leftover .dark block", () => {
    expect(css).not.toContain(".dark {");
    expect(css.match(/--background:/g)?.length).toBe(2); // :root, and the print override
  });

  it("is dark: the page is near-black and the text is near-white", () => {
    expect(rootBlock).toMatch(/--background: 0 0% [0-9]%;/);
    expect(rootBlock).toMatch(/--foreground: 0 0% 9[0-9]%;/);
  });

  /**
   * The accent is bright enough that white on it is unreadable, so its
   * foreground has to be the dark end. This is the one contrast pairing in the
   * file that a reasonable-looking edit can silently break — every filled button
   * in the app is `bg-primary text-primary-foreground`.
   */
  it("puts dark text on the bright accent, never white", () => {
    const fg = rootBlock.match(/--primary-foreground: 0 0% ([0-9]+)%;/);
    expect(fg, "--primary-foreground must be a neutral").not.toBeNull();
    expect(Number(fg![1])).toBeLessThan(20);
  });
});

describe("the print override", () => {
  const printBlock = css.slice(css.indexOf("@media print"));

  /**
   * The evaluation report is a document people hand over, and with no light
   * palette left to fall back on, any surface token the print block forgets
   * prints as a dark grey panel.
   */
  it("flips every surface back to light, not just the page", () => {
    for (const token of ["--background", "--card", "--popover", "--muted", "--border"]) {
      expect(printBlock, token).toContain(`${token}: `);
    }
    expect(printBlock).toContain("--background: 0 0% 100%");
  });

  it("inverts the signal colours too, so a readiness badge stays legible", () => {
    for (const token of ["--success", "--warning", "--destructive"]) {
      expect(printBlock, token).toContain(`${token}: `);
      expect(printBlock, token).toContain(`${token}-foreground: 0 0% 100%`);
    }
  });
});

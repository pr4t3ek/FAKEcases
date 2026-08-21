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

/** The light palette: `:root`, up to where the dark override begins. */
const lightBlock = css.slice(css.indexOf(":root {"), css.indexOf(".dark {"));
/** The dark palette: `.dark`, up to the print override that follows it. */
const darkBlock = css.slice(css.indexOf(".dark {"), css.indexOf("@media print"));

describe("the palette", () => {
  /*
   * Both, not either. A token defined in one theme and forgotten in the other
   * is the quiet failure this file exists for: `hsl()` with an empty variable
   * renders transparent, so the miss shows up as an invisible border or a card
   * that is suddenly the page colour — and only in the theme nobody tested.
   */
  it("defines every token Tailwind maps, in both themes", () => {
    expect(mapped.length).toBeGreaterThan(10);
    for (const token of mapped) {
      expect(lightBlock, `${token} (light)`).toContain(`${token}:`);
      expect(darkBlock, `${token} (dark)`).toContain(`${token}:`);
    }
  });

  it("is dark where it should be: near-black page, near-white text", () => {
    expect(darkBlock).toMatch(/--background: 0 0% [0-9]%;/);
    expect(darkBlock).toMatch(/--foreground: 0 0% 9[0-9]%;/);
  });

  it("is light where it should be: white page, dark text", () => {
    expect(lightBlock).toMatch(/--background: 0 0% 100%;/);
    expect(lightBlock).toMatch(/--foreground: 222 47% 11%;/);
  });

  /**
   * The one contrast pairing a reasonable-looking edit can silently break, and
   * it inverts between the themes: every filled button in the app is
   * `bg-primary text-primary-foreground`, the dark theme's cyan is bright
   * enough that white on it is unreadable, and the light theme's is dark enough
   * that near-black on it is.
   */
  it("puts dark text on the bright accent, and white on the dark one", () => {
    const darkFg = darkBlock.match(/--primary-foreground: 0 0% ([0-9]+)%;/);
    expect(darkFg, "dark --primary-foreground must be a neutral").not.toBeNull();
    expect(Number(darkFg![1])).toBeLessThan(20);

    const lightFg = lightBlock.match(/--primary-foreground: 0 0% ([0-9]+)%;/);
    expect(lightFg, "light --primary-foreground must be a neutral").not.toBeNull();
    expect(Number(lightFg![1])).toBeGreaterThan(80);
  });

  /*
   * Dark has to be what renders before any JavaScript decides otherwise, or a
   * visitor with JS off — and every visitor for the first paint — meets a
   * product that is not the one this was designed as.
   */
  it("ships dark in the server-rendered HTML", () => {
    const layout = readFileSync(resolve(__dirname, "../app/layout.tsx"), "utf8");
    expect(layout).toMatch(/className=\{`dark /);
    // The script only ever removes it — nothing may add `dark` at runtime and
    // make the default depend on JS having run.
    expect(layout).toContain("classList.remove('dark')");
    expect(layout).toContain("suppressHydrationWarning");
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

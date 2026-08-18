import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";

/**
 * Two faces, self-hosted, in four files.
 *
 * **Self-hosted rather than `next/font/google`** because this project's posture
 * is that it runs with no external services: `next/font/google` fetches at build
 * time, so a rebuild on a machine with no network would fail on a font. These
 * are the same Google-served variable subsets, downloaded once and committed.
 *
 * **Two subsets per face, and the split is load-bearing.** Google's `latin`
 * subset does not include U+20B9 — the rupee sign — which appears on nearly
 * every screen of an India-focused app. It lives in `latin-ext`, so each family
 * is declared twice and both are listed in the Tailwind font stack: the browser
 * resolves per glyph, taking ₹ from the second file and everything else from the
 * first. One `src` array would not do this; multiple sources in a single
 * `@font-face` are failure fallbacks, not coverage fallbacks.
 *
 * `adjustFontFallback` is left on (the default), so the system face swaps in with
 * corrected metrics and text does not jump on load.
 *
 * The const names are load-bearing in one small way: `next/font/local` derives
 * the generated CSS family name from them, so these are what a computed font
 * stack reads as in devtools.
 */
const interSans = localFont({
  src: "./fonts/Inter-Variable.woff2",
  variable: "--font-sans",
  display: "swap",
  weight: "100 900",
});

const interSansExt = localFont({
  src: "./fonts/Inter-Variable-LatinExt.woff2",
  variable: "--font-sans-ext",
  display: "swap",
  weight: "100 900",
});

/** Headings. A tighter grotesk than the body face — see `h1,h2,h3` in globals.css. */
const interTight = localFont({
  src: "./fonts/InterTight-Variable.woff2",
  variable: "--font-display",
  display: "swap",
  weight: "100 900",
});

const interTightExt = localFont({
  src: "./fonts/InterTight-Variable-LatinExt.woff2",
  variable: "--font-display-ext",
  display: "swap",
  weight: "100 900",
});

export const metadata: Metadata = {
  /*
   * The tab is a narrow place — a pinned tab shows about twelve characters — so
   * the name goes first and the tagline follows it, rather than a sentence that
   * truncates before it says anything. The emoji stays out of the title and
   * lives on the landing page instead: it is a wink in a headline and a
   * rendering lottery in a tab strip and a search result.
   */
  title: "CASE CLOSED — Because “It Depends” Isn't an Answer",
  description:
    "Practice India-focused guesstimates, business cases and product decision simulations with an AI interviewer that questions you like a McKinsey/BCG/Bain panel — Socratic hints, structured frameworks and a detailed evaluation. Because “It Depends” isn't an answer.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    /**
     * `dark` is a constant, not a preference. There is one palette (see
     * globals.css), and the class is still here rather than dropped because a
     * handful of components carry `dark:` variants for their amber and emerald
     * notes; without it those would resolve to their light values on a
     * near-black card.
     *
     * No `suppressHydrationWarning` any more: it existed for the theme script
     * that used to rewrite this element before React hydrated, and nothing
     * mutates it now.
     */
    <html
      lang="en"
      className={`dark ${interSans.variable} ${interSansExt.variable} ${interTight.variable} ${interTightExt.variable}`}
    >
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

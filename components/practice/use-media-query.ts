"use client";

import { useEffect, useState } from "react";

/**
 * Track a media query from React.
 *
 * Starts `false` and corrects after mount, deliberately: reading `matchMedia`
 * during render would disagree with the server's HTML and hydrate wrong. The
 * practice screen uses it to swap panels for tabs, and the framework builder to
 * swap the flow-diagram canvas for the outline — a canvas is not usable at
 * phone width.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    setMatches(m.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    m.addEventListener("change", handler);
    return () => m.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

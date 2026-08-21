"use client";

import { useCallback, useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/**
 * Light or dark, remembered in the browser.
 *
 * Hand-rolled rather than `next-themes`, which this repo removed on purpose when
 * it went dark-only. What that library buys is system-preference tracking and a
 * provider; what is needed here is one class on one element and one key in
 * storage, and the pre-paint half of the job is already done by `THEME_SCRIPT`
 * in app/layout.tsx. A dependency for the remainder would be the only package in
 * this project doing less than the code it replaces.
 *
 * **Dark is the default and lives in the server-rendered HTML**, so this only
 * ever has to record a departure from it. The key is read in two places — here
 * and in that script — and they have to agree, which is why the name is
 * exported rather than typed twice.
 */
export const THEME_KEY = "cc-theme";

type Theme = "light" | "dark";

/** What the document is showing right now, read off the element itself. */
function currentTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/**
 * The live theme, for anything that has to be told rather than styled.
 *
 * CSS variables cover every component in the app; this exists for the handful
 * that take a colour scheme as a prop instead — Sonner is the one today, and it
 * defaults to light and does not read the document, which is how toasts once
 * rendered as light cards on a dark app for as long as dark mode existed.
 *
 * Starts at "dark" on both server and first client render so hydration matches
 * the server-rendered class, then corrects itself in the effect if the reader
 * chose light.
 */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setTheme(currentTheme());

    // Any other copy of this hook flipping the class has to reach this one, or
    // a toggle in the menu would leave the toaster on the old scheme until a
    // reload. Cheap: one observer on one attribute of one element.
    const observer = new MutationObserver(() => setTheme(currentTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const toggle = useCallback(() => {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Private window, or site data blocked. The choice still applies to this
      // page; it just will not survive a reload, which beats throwing.
    }
    setTheme(next);
  }, []);

  return { theme, toggle };
}

/**
 * The control, shaped for a dropdown row rather than a standalone button — it is
 * rendered inside the account menu, where the header had no room left beside the
 * streak, XP, rank and nav.
 */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const goingTo = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex w-full cursor-pointer items-center gap-2 text-left"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span>Switch to {goingTo} mode</span>
    </button>
  );
}

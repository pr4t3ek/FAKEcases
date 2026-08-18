"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The clock, owned above every chrome that shows it.
 *
 * It used to live inside `ToolsPanel`. Fullscreen doesn't render that panel, so
 * left there the overlay would either show no clock or mount a second one that
 * starts at zero and drifts from the first — two different answers to "how long
 * have I been on this case".
 *
 * **It does not pause.** A pause button on a clock that is also the leaderboard
 * tiebreak (`Attempt.timeSpentSec`, lower wins) is an invitation to stop the
 * clock and keep thinking, and a stopwatch two people can run under different
 * rules is not a tiebreak. It runs from mount until the attempt is submitted,
 * which is what an interview does.
 *
 * Shared by practice and the war room, which is why persistence arrives as a
 * callback rather than an imported action: the two write different rows.
 */
export function useElapsedTimer({
  initial,
  /** Finished work has a final number; nothing should keep adding to it. */
  frozen,
  onPersist,
}: {
  initial: number;
  frozen: boolean;
  onPersist: (seconds: number) => Promise<unknown>;
}) {
  const [elapsed, setElapsed] = useState(initial);

  useEffect(() => {
    if (frozen) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [frozen]);

  /*
   * Persist every 15s so a closed tab loses seconds rather than a session.
   *
   * The latest count and the latest callback are read through a ref, so the
   * interval is created once for the life of the screen. Depending on `elapsed`
   * instead — which is what this did — tore down and rebuilt the interval on
   * every tick, meaning the 15 seconds never elapsed on a slow render and the
   * save could simply never fire.
   */
  const latest = useRef({ elapsed, onPersist });
  latest.current = { elapsed, onPersist };

  useEffect(() => {
    if (frozen) return;
    const id = setInterval(() => {
      latest.current.onPersist(latest.current.elapsed).catch(() => {});
    }, 15000);
    return () => clearInterval(id);
  }, [frozen]);

  return elapsed;
}

export function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

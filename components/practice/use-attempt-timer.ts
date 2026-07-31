"use client";

import { useEffect, useState } from "react";
import { saveTime } from "@/app/actions/practice";

/**
 * The attempt clock, owned above every chrome that shows it.
 *
 * It used to live inside `ToolsPanel`. Fullscreen doesn't render that panel, so
 * left there the overlay would either show no clock or mount a second one that
 * starts at zero and drifts from the first — two different answers to "how long
 * have I been on this case".
 */
export function useAttemptTimer(attemptId: string, initialTime: number, disabled: boolean) {
  const [elapsed, setElapsed] = useState(initialTime);
  const [running, setRunning] = useState(!disabled);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  // Periodic persistence, so a closed tab doesn't lose the whole session.
  useEffect(() => {
    if (disabled) return;
    const id = setInterval(() => saveTime(attemptId, elapsed).catch(() => {}), 15000);
    return () => clearInterval(id);
  }, [attemptId, elapsed, disabled]);

  return { elapsed, running, setRunning };
}

export function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** How often the console asks. A classroom minute, not a game frame. */
export const POLL_MS = 5_000;

/**
 * The host console's five-second poll, shared by both boards.
 *
 * Extracted rather than written twice: a war-room console and a practice console
 * render different tables from different rosters, but "ask every five seconds,
 * skip rather than queue, stop when the tab is hidden, keep the last good
 * payload on a failure" is one behaviour, and two copies of it would drift on the
 * details that matter — the abort on unmount, or the catch-up on refocus.
 *
 * Generic over the payload for the same reason `loadRoster` and
 * `loadPracticeRoster` are separate functions: the shape differs, the transport
 * does not.
 *
 * Polling rather than SSE or `router.refresh()`:
 *
 *   - `router.refresh()` is this repo's idiom for re-reading AFTER a mutation,
 *     and every one of its uses fires once in response to an action. On a
 *     five-second loop it re-renders the whole RSC tree — header, streak, XP,
 *     rank badge — ships the full page payload each time, cannot be aborted,
 *     cannot be paused when the tab is hidden, and resets client state on every
 *     tick.
 *   - SSE would be right if there were an event to push. There isn't: a
 *     self-paced room has no moment the server knows about that the client
 *     doesn't, so a stream would be a poll with extra machinery.
 *
 * One poller per console, never per student — `/room/[code]` does not poll.
 */
export function useRosterPoll<T>(code: string, initial: T): { roster: T; stale: boolean } {
  const [roster, setRoster] = useState<T>(initial);
  const [stale, setStale] = useState(false);
  // Held in a ref rather than state: a request in flight must not re-trigger the
  // effect that owns the interval.
  const inFlight = useRef<AbortController | null>(null);

  const poll = useCallback(async () => {
    // Skip rather than queue. A slow response on a classroom wifi should not
    // build a backlog of requests that all land at once.
    if (inFlight.current) return;

    const controller = new AbortController();
    inFlight.current = controller;
    try {
      const res = await fetch(`/api/host/${code}/roster`, {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!res.ok) throw new Error(String(res.status));
      setRoster((await res.json()).roster as T);
      setStale(false);
    } catch (error) {
      // An aborted request is the component unmounting, not a failure.
      if ((error as Error)?.name !== "AbortError") setStale(true);
    } finally {
      inFlight.current = null;
    }
  }, [code]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    function start() {
      if (timer) return;
      timer = setInterval(poll, POLL_MS);
    }
    function stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    }

    // A projector tab left open over lunch should not poll for an hour.
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        stop();
      } else {
        // Catch up immediately rather than waiting out an interval — coming
        // back to a five-second-stale table reads as broken.
        void poll();
        start();
      }
    }

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      inFlight.current?.abort();
    };
  }, [poll]);

  return { roster, stale };
}

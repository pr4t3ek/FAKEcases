"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CircleDashed, Loader2, Trophy, Users } from "lucide-react";
import type { Roster, RosterRow } from "@/lib/rooms/roster";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

/** How often the console asks. A classroom minute, not a game frame. */
const POLL_MS = 5_000;

const stateMeta: Record<
  RosterRow["state"],
  { label: string; variant: "muted" | "warning" | "success" }
> = {
  joined: { label: "Not started", variant: "muted" },
  playing: { label: "Playing", variant: "warning" },
  finished: { label: "Finished", variant: "success" },
};

/**
 * The host console's live table.
 *
 * Seeded with a roster the page already rendered on the server, so the first
 * paint is correct and the screen is useful even if the poll never succeeds.
 * Both paths shape their rows with the same `buildRoster`, which is what stops
 * the table changing shape a moment after it loads.
 *
 * Polling rather than SSE or `router.refresh()`:
 *
 *   - `router.refresh()` is this repo's idiom for re-reading AFTER a mutation,
 *     and every one of its fourteen uses fires once in response to an action. On
 *     a five-second loop it re-renders the whole RSC tree — header, streak, XP,
 *     rank badge — ships the full page payload each time, cannot be aborted,
 *     cannot be paused when the tab is hidden, and resets client state on every
 *     tick.
 *   - SSE would be right if there were an event to push. There isn't: a
 *     self-paced room has no moment the server knows about that the client
 *     doesn't, so a stream would be a poll with extra machinery. (The classroom
 *     shell in docs/SCRUM_SIMULATOR.md §8 reaches for SSE precisely because that
 *     feature IS lockstep.)
 *
 * One poller per console, never per student — `/room/[code]` does not poll.
 */
export function RosterBoard({
  code,
  initial,
  roomOpen,
}: {
  code: string;
  initial: Roster;
  roomOpen: boolean;
}) {
  const [roster, setRoster] = useState<Roster>(initial);
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
      setRoster((await res.json()).roster as Roster);
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

  const { rows, summary } = roster;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat icon={Users} label="In the room" value={rows.length} />
        <Stat icon={CircleDashed} label="Not started" value={summary.joined} />
        <Stat icon={Loader2} label="Playing" value={summary.playing} />
        <Stat
          icon={Trophy}
          label="Finished"
          value={summary.finished}
          sub={summary.averageScore === null ? undefined : `avg ${summary.averageScore}`}
        />
      </div>

      {rows.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          {roomOpen ? (
            <>
              Nobody has joined yet. Read out the code and the password.
              <br />
              <span className="text-xs">
                Students joining on a phone stay signed in on that device only — if they switch
                devices they&apos;ll need to join again.
              </span>
            </>
          ) : (
            "This room is closed, and nobody joined while it was open."
          )}
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Student</th>
                <th className="p-3">State</th>
                <th className="p-3">Phase</th>
                <th className="p-3 text-right">Analyst-days</th>
                <th className="p-3 text-right">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.userId} className="hover:bg-accent/40">
                  <td className="p-3">
                    <div className="font-medium">{row.displayName}</div>
                    {/* Two students typing the same first name are otherwise
                        indistinguishable. The professor is the only reader. */}
                    <div className="text-xs text-muted-foreground">
                      {row.email ?? "guest"} · joined{" "}
                      {new Date(row.joinedAt).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge variant={stateMeta[row.state].variant}>
                      {stateMeta[row.state].label}
                    </Badge>
                  </td>
                  <td className="p-3 capitalize text-muted-foreground">{row.phase ?? "—"}</td>
                  <td className="p-3 text-right tabular-nums">{row.daysSpent ?? "—"}</td>
                  <td className="p-3 text-right tabular-nums">
                    {row.overall === null ? (
                      "—"
                    ) : (
                      <span className="font-medium">
                        {row.overall}
                        {row.band && (
                          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                            {row.band}
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* The last good roster stays on screen — blanking the table because one
          request failed would be worse than showing a table five seconds old. */}
      {stale && (
        <p className="text-center text-xs text-muted-foreground">
          Couldn&apos;t reach the server just now — showing the last update.
        </p>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <div className="text-xl font-semibold tabular-nums">{value}</div>
        <div className="truncate text-xs text-muted-foreground">
          {label}
          {sub && ` · ${sub}`}
        </div>
      </div>
    </Card>
  );
}

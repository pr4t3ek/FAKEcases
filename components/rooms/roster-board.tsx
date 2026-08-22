"use client";

import { useState } from "react";
import { CircleDashed, Loader2, Trophy, Users } from "lucide-react";
import type { Roster, RosterRow } from "@/lib/rooms/roster";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClassStandings } from "@/components/rooms/class-standings";
import { ClassAnalytics } from "@/components/rooms/class-analytics";
import { RosterStat } from "@/components/rooms/roster-stat";
import { useRosterPoll } from "@/components/rooms/use-roster-poll";

/** Roster is who is here, standings is who won, analytics is how it went. */
type View = "roster" | "standings" | "analytics";

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
 * The five-second loop itself is `useRosterPoll`, shared with the practice
 * console; the reasoning for polling rather than SSE or `router.refresh()` lives
 * there, beside the code it explains. (The classroom shell in
 * docs/SCRUM_SIMULATOR.md §8 reaches for SSE precisely because that feature IS
 * lockstep.)
 */
export function RosterBoard({
  code,
  initial,
  roomOpen,
  causes,
  trueCauseIds,
  scenarioKnown,
}: {
  code: string;
  initial: Roster;
  roomOpen: boolean;
  /**
   * The scenario's board, resolved server-side.
   *
   * Static for the life of a room, so it rides in as a prop rather than in the
   * poll — the five-second payload has no reason to carry the same twelve
   * labels again and again.
   */
  causes: { id: string; label: string }[];
  trueCauseIds: string[];
  scenarioKnown: boolean;
}) {
  const [view, setView] = useState<View>("roster");
  const { roster, stale } = useRosterPoll<Roster>(code, initial);

  const { rows, summary } = roster;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <RosterStat icon={Users} label="In the room" value={rows.length} />
        <RosterStat icon={CircleDashed} label="Not started" value={summary.joined} />
        <RosterStat icon={Loader2} label="Playing" value={summary.playing} />
        <RosterStat
          icon={Trophy}
          label="Finished"
          value={summary.finished}
          sub={summary.averageScore === null ? undefined : `avg ${summary.averageScore}`}
        />
      </div>

      {/* One poller, two views. The standings read the same live state this
          component already maintains — a second fetch would double the console's
          request rate to render numbers it is holding. */}
      <Tabs value={view} onValueChange={(v) => setView(v as View)}>
        <TabsList>
          <TabsTrigger value="roster">Roster</TabsTrigger>
          <TabsTrigger value="standings">
            Standings
            {summary.finished > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground">{summary.finished}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="analytics">Class analytics</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === "analytics" ? (
        <ClassAnalytics
          roster={roster}
          causes={causes}
          trueCauseIds={trueCauseIds}
          scenarioKnown={scenarioKnown}
        />
      ) : view === "standings" ? (
        <ClassStandings roster={roster} />
      ) : rows.length === 0 ? (
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

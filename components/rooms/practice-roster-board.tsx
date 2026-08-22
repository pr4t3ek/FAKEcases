"use client";

import { CircleDashed, Crosshair, Loader2, Trophy, Users } from "lucide-react";
import type { PracticeRoster, PracticeRosterRow } from "@/lib/rooms/practice-roster";
import { formatIndianNumber } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { RosterStat } from "@/components/rooms/roster-stat";
import { useRosterPoll } from "@/components/rooms/use-roster-poll";

const stateMeta: Record<
  PracticeRosterRow["state"],
  { label: string; variant: "muted" | "warning" | "success" }
> = {
  joined: { label: "Not started", variant: "muted" },
  working: { label: "Working", variant: "warning" },
  submitted: { label: "Submitted", variant: "success" },
};

/**
 * The host console's live table for a room running a guesstimate.
 *
 * A sibling of `RosterBoard` rather than a mode of it. They share the poll
 * (`useRosterPoll`) and the stat card, which is the part that is genuinely the
 * same; everything the war-room board does beyond its first tab is
 * war-room-shaped — standings ranked on analyst-days, a cause-mix chart, a
 * budget line — and folding two tables and three absent tabs into one component
 * would have cost more in branches than the table below costs in lines.
 *
 * Seeded with a roster the page already rendered on the server, so the first
 * paint is correct and the screen is useful even if the poll never succeeds.
 * Both paths shape their rows with the same `buildPracticeRoster`, which is what
 * stops the table changing shape a moment after it loads.
 */
export function PracticeRosterBoard({
  code,
  initial,
  roomOpen,
  unit,
  idealLow,
  idealHigh,
}: {
  code: string;
  initial: PracticeRoster;
  roomOpen: boolean;
  /**
   * The question's authored band, resolved server-side.
   *
   * Static for the life of a room, so it rides in as a prop rather than in the
   * poll — and it is what makes an estimate on this table readable. A column of
   * numbers with nothing to compare them against tells a professor only who
   * answered, not who was close.
   */
  unit: string | null;
  idealLow: number | null;
  idealHigh: number | null;
}) {
  const { roster, stale } = useRosterPoll<PracticeRoster>(code, initial);
  const { rows, summary } = roster;

  const band =
    idealLow !== null && idealHigh !== null
      ? `${formatIndianNumber(idealLow)}–${formatIndianNumber(idealHigh)}${unit ? ` ${unit}` : ""}`
      : null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <RosterStat icon={Users} label="In the room" value={rows.length} />
        <RosterStat icon={CircleDashed} label="Not started" value={summary.joined} />
        <RosterStat icon={Loader2} label="Working" value={summary.working} />
        <RosterStat
          icon={Trophy}
          label="Submitted"
          value={summary.submitted}
          sub={summary.averageScore === null ? undefined : `avg ${summary.averageScore}`}
        />
      </div>

      {/* The answer the class is aiming at, said once above the table rather
          than repeated down a column. Absent on a question with no authored
          band, which is the honest rendering — there is nothing to be within. */}
      {band && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Crosshair className="h-3.5 w-3.5" /> Accepted range {band}
          {/* The tally only once there is something to tally. "0 of 0 inside it"
              is the state this screen opens in, and it reads as a class doing
              badly rather than as a class that has not answered yet. */}
          {summary.submitted > 0 && (
            <>
              {" · "}
              <span className="font-medium text-foreground">{summary.withinBand}</span> of{" "}
              {summary.submitted} inside it
            </>
          )}
        </p>
      )}

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
                <th className="p-3 text-right">Estimate</th>
                <th className="p-3 text-right">Time</th>
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
                  <td className="p-3 text-right tabular-nums">
                    {row.finalEstimate === null ? (
                      "—"
                    ) : (
                      <span className={row.accuracyHit ? "font-medium text-success" : undefined}>
                        {formatIndianNumber(row.finalEstimate)}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right tabular-nums text-muted-foreground">
                    {row.timeSpentSec === null ? "—" : `${Math.round(row.timeSpentSec / 60)}m`}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {row.overall === null ? (
                      // A submitted attempt with no score is Teacher mode, which
                      // states the answer and so measures nothing — see the note
                      // on `Evaluation.overall`. A zero here would be a lie.
                      <span className="text-muted-foreground">
                        {row.state === "submitted" ? "unscored" : "—"}
                      </span>
                    ) : (
                      <span className="font-medium">{row.overall}</span>
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

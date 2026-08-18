"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LeaderboardTable,
  YourStanding,
  type BoardRow,
} from "@/components/leaderboard/leaderboard-table";

type LeaderboardTab = "day" | "week" | "all";

export interface BoardSide {
  rows: BoardRow[];
  you: { rank: number; total: number; points: number } | null;
}

/**
 * The cumulative board — today, this week, all time.
 *
 * Every window is loaded on the server and switched client-side: they are a
 * handful of rows each, and making the tab a fetch would put a spinner on the
 * dashboard for data that was already in the payload.
 *
 * **Today leads where it is offered**, and that is not arbitrary. Under the
 * daily unlock the whole cohort works the same guesstimate on the same day, so
 * a daily board ranks people on one shared problem rather than on how much of
 * the library they happen to have got through — the only window where the
 * comparison is genuinely like-for-like. It also resets, which is what makes it
 * worth coming back to.
 *
 * Weekly is the fallback default, for surfaces with no daily side. All-time
 * rewards whoever started earliest and is unreachable for anyone who joined last
 * month, so it makes a poor default anywhere — it is kept because long-run
 * effort deserves somewhere to show, not because it is the number to return for.
 *
 * `day` is optional so a surface that has not wired one up keeps working
 * unchanged, tabs and default included.
 */
export function GlobalLeaderboard({
  day,
  week,
  all,
  currentUserId,
  title = "Practice leaderboard",
  /**
   * What a point is on this board.
   *
   * Named because there are two boards now, and they must not be read as one:
   * practice points come off the interview rubric, war-room points off a
   * different one entirely. Summing them — which this used to do — produced a
   * number measuring nothing.
   */
  unit = "question",
  emptyToday = "Nobody has ranked today yet. Be the first \u2014 today's question is on your dashboard.",
  emptyThisWeek = "No ranked results yet this week. Solve something new to open the board.",
  emptyAllTime = "No ranked results yet. Your first attempt at any question puts you here.",
}: {
  /** Omit to render only the weekly and all-time windows. */
  day?: BoardSide;
  week: BoardSide;
  all: BoardSide;
  currentUserId: string;
  title?: string;
  unit?: string;
  emptyToday?: string;
  emptyThisWeek?: string;
  emptyAllTime?: string;
}) {
  const [window, setWindow] = useState<LeaderboardTab>(day ? "day" : "week");
  const side = window === "day" ? (day ?? week) : window === "week" ? week : all;
  const emptyMessage =
    window === "day" ? emptyToday : window === "week" ? emptyThisWeek : emptyAllTime;
  const inTop = side.rows.some((r) => r.userId === currentUserId);

  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-warning" />
          <h2 className="font-semibold">{title}</h2>
        </div>
        <Tabs value={window} onValueChange={(v) => setWindow(v as LeaderboardTab)}>
          <TabsList>
            {day && <TabsTrigger value="day">Today</TabsTrigger>}
            <TabsTrigger value="week">This week</TabsTrigger>
            <TabsTrigger value="all">All time</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        Points are the sum of your <strong className="text-foreground">first-attempt</strong> scores
        on each {unit}. Replaying one you have already ranked does not add any.
      </p>

      <LeaderboardTable
        rows={side.rows}
        currentUserId={currentUserId}
        emptyMessage={emptyMessage}
      />

      {side.you && !inTop && side.you.rank > 0 && (
        <YourStanding
          rank={side.you.rank}
          total={side.you.total}
          value={side.you.points}
          label="points"
        />
      )}
    </Card>
  );
}

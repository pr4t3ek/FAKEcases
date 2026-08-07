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

export interface BoardSide {
  rows: BoardRow[];
  you: { rank: number; total: number; points: number } | null;
}

/**
 * The cumulative board, weekly and all-time.
 *
 * Both windows are loaded on the server and switched client-side: they are a
 * handful of rows each, and making the tab a fetch would put a spinner on the
 * dashboard for data that was already in the payload.
 *
 * Weekly leads. An all-time table rewards whoever started earliest and is
 * unreachable for anyone who joined last month, so it makes a poor default —
 * it is kept because long-run effort deserves somewhere to show, not because it
 * is the number to come back for.
 */
export function GlobalLeaderboard({
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
  emptyThisWeek = "No ranked results yet this week. Solve something new to open the board.",
  emptyAllTime = "No ranked results yet. Your first attempt at any question puts you here.",
}: {
  week: BoardSide;
  all: BoardSide;
  currentUserId: string;
  title?: string;
  unit?: string;
  emptyThisWeek?: string;
  emptyAllTime?: string;
}) {
  const [window, setWindow] = useState<"week" | "all">("week");
  const side = window === "week" ? week : all;
  const inTop = side.rows.some((r) => r.userId === currentUserId);

  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-warning" />
          <h2 className="font-semibold">{title}</h2>
        </div>
        <Tabs value={window} onValueChange={(v) => setWindow(v as "week" | "all")}>
          <TabsList>
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
        emptyMessage={window === "week" ? emptyThisWeek : emptyAllTime}
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

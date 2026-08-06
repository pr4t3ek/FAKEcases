import { Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  LeaderboardTable,
  UnrankedNotice,
  YourStanding,
  type BoardRow,
} from "./leaderboard-table";

/**
 * The per-question board, as it appears at the bottom of a report.
 *
 * One component for both the evaluation report and the simulation debrief, so
 * the two can never drift on the rule they are both explaining — that only a
 * first attempt is ranked.
 */
export function QuestionBoard({
  rows,
  kind,
  userId,
  standing,
  thisScore,
}: {
  rows: BoardRow[];
  /** "attempt" | "simulation" — decides how the tiebreak is worded. */
  kind: string;
  userId?: string;
  standing?: {
    rank: number;
    total: number;
    score: number;
    effort: number;
    isThisAttempt: boolean;
  } | null;
  /** The score just earned, for the replay comparison. */
  thisScore: number;
}) {
  // Off the board entirely: a guest, whose result is scored but never ranked.
  const inTop = rows.some((r) => r.userId === userId);
  const replay = standing != null && !standing.isThisAttempt;

  return (
    <Card className="mt-5 p-6">
      <div className="mb-1 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-warning" />
        <h2 className="font-semibold">Leaderboard</h2>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        First attempts only — {kind === "simulation" ? "fewer analyst-days" : "less time"} breaks a
        tie.
      </p>

      {replay && standing && (
        <div className="mb-3">
          <UnrankedNotice rankedScore={standing.score} thisScore={thisScore} />
        </div>
      )}

      <LeaderboardTable
        rows={rows}
        currentUserId={userId}
        kind={kind}
        emptyMessage="Nobody has ranked on this one yet — you could be first."
      />

      {/* Their own line, only when they aren't already visible above. */}
      {standing && !inTop && standing.rank > 0 && (
        <YourStanding
          rank={standing.rank}
          total={standing.total}
          value={standing.score}
          label="ranked score"
        />
      )}
    </Card>
  );
}

import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import {
  LeaderboardTable,
  NotScoredNotice,
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
  className,
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
  /**
   * The score just earned, for the replay comparison. Null when the attempt
   * wasn't scored at all — nothing was recorded and nothing can be ranked.
   * Omitted where no attempt is in view at all (the dashboard), which is not the
   * same thing: see the notices below.
   */
  thisScore?: number | null;
  className?: string;
}) {
  // Off the board entirely: a guest, whose result is scored but never ranked.
  const inTop = rows.some((r) => r.userId === userId);
  /*
   * Both notices explain a result the reader has just been shown, so both need
   * one to exist. `standing` is what says there is one: on a report there always
   * is, and on the dashboard — where this board sits under a question nobody has
   * necessarily opened — there is not, and announcing "you were shown the
   * answer" to somebody who has not started would be nonsense.
   *
   * Unscored takes precedence over the replay wording: a walked-through attempt
   * was never a candidate for the slot, whether or not one was already taken.
   */
  const notScored = standing != null && thisScore == null;
  const replay = !notScored && standing != null && !standing.isThisAttempt;

  return (
    <Card className={cn("mt-5 p-6", className)}>
      <div className="mb-1 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-warning" />
        <h2 className="font-semibold">Leaderboard</h2>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        First attempts only — {kind === "simulation" ? "fewer analyst-days" : "less time"} breaks a
        tie.
      </p>

      {notScored && (
        <div className="mb-3">
          <NotScoredNotice />
        </div>
      )}

      {replay && standing && (
        <div className="mb-3">
          <UnrankedNotice rankedScore={standing.score} thisScore={thisScore ?? null} />
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

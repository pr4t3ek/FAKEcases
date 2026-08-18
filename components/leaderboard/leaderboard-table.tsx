import { Crown, Medal, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatEffort } from "@/lib/leaderboard";

/**
 * One table for both boards.
 *
 * Presentational only — it takes rows already ordered and ranked by
 * `lib/leaderboard.ts`, because a component that re-sorts is a second opinion
 * about who won.
 */

export interface BoardRow {
  userId: string;
  rank: number;
  name: string;
  /**
   * "PGP-1" / "PGP-2", or null for an account that predates the field.
   *
   * Required on the type rather than optional, so a new board has to decide what
   * to pass. An optional one would let a caller drop the batch silently, and a
   * board missing half its labels looks like a data problem rather than a
   * forgotten line.
   */
  batch: string | null;
  /** The headline number: a score on a question board, points on the global one. */
  value: number;
  /** Small print under the value — "3 analyst-days", "12 solved". */
  detail: string | null;
}

/** Medal for the top three, plain number after that. */
function RankMark({ rank }: { rank: number }) {
  const Icon = rank === 1 ? Crown : rank <= 3 ? Medal : null;
  const tone =
    rank === 1
      ? "text-warning"
      : rank === 2
        ? "text-muted-foreground"
        : rank === 3
          ? "text-primary"
          : "text-muted-foreground";

  return (
    <span className={cn("flex w-7 shrink-0 items-center justify-center", tone)}>
      {Icon ? <Icon className="h-4 w-4" /> : <span className="text-xs font-medium">{rank}</span>}
    </span>
  );
}

export function LeaderboardTable({
  rows,
  /** Highlights the viewer's own row. */
  currentUserId,
  /** Formats `detail` for a question board; omitted on the global board. */
  kind,
  emptyMessage,
}: {
  rows: BoardRow[];
  currentUserId?: string;
  kind?: string;
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <ol className="space-y-1">
      {rows.map((row) => {
        const isYou = row.userId === currentUserId;
        const detail = kind ? formatEffort(kind, Number(row.detail ?? 0)) : row.detail;

        return (
          <li
            key={row.userId}
            className={cn(
              "flex items-center gap-3 rounded-md px-2 py-2 text-sm",
              isYou && "bg-primary/10 ring-1 ring-primary/30",
            )}
          >
            <RankMark rank={row.rank} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">
                {row.name}
                {isYou && <span className="ml-1.5 text-xs text-primary">you</span>}
              </div>
              {/* The batch alone, where the college used to sit beside it: one
                  campus, so the college said the same thing on every row. */}
              {row.batch && (
                <div className="truncate text-xs text-muted-foreground">{row.batch}</div>
              )}
            </div>
            <div className="shrink-0 text-right">
              <div className="font-semibold tabular-nums">{row.value}</div>
              {detail && <div className="text-xs text-muted-foreground">{detail}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The viewer's own line, shown when they didn't make the visible top slice.
 *
 * Their position is shown to THEM and never listed publicly — the board names
 * only the people at the top, so appearing on it means you did well rather than
 * that you took part.
 */
export function YourStanding({
  rank,
  total,
  value,
  label,
}: {
  rank: number;
  total: number;
  value: number;
  label: string;
}) {
  return (
    <div className="mt-2 flex items-center gap-3 rounded-md border border-dashed px-2 py-2 text-sm">
      <span className="flex w-7 shrink-0 justify-center text-xs font-medium text-primary">
        {rank > 0 ? rank : "—"}
      </span>
      <div className="min-w-0 flex-1">
        <span className="font-medium">You</span>
        {rank > 0 && (
          <span className="ml-1.5 text-xs text-muted-foreground">of {total}</span>
        )}
      </div>
      <div className="shrink-0 text-right">
        <div className="font-semibold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

/**
 * The badge a replay gets instead of a rank.
 *
 * Named "unranked" rather than hidden, and it shows the ranked score beside the
 * one just earned, because the honest thing to tell someone who scored better
 * on a retry is what they scored — and why it did not count.
 */
export function UnrankedNotice({
  rankedScore,
  thisScore,
}: {
  rankedScore: number;
  /** Null when this attempt wasn't scored — nothing to compare against. */
  thisScore: number | null;
}) {
  return (
    <div className="rounded-md border border-dashed border-warning/40 bg-warning/5 px-3 py-2.5 text-sm">
      <div className="flex items-center gap-1.5 font-medium">
        <Trophy className="h-3.5 w-3.5 text-warning" /> Unranked — this was a replay
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Only a first attempt is ranked, because a retry is easier once you know roughly where the
        answer lands. Your ranked score stays <strong className="text-foreground">{rankedScore}</strong>
        {thisScore != null && thisScore !== rankedScore && <> — you scored {thisScore} this time.</>}
      </p>
    </div>
  );
}

/**
 * The badge an unscored attempt gets instead of a rank.
 *
 * A sibling of `UnrankedNotice` rather than a branch inside it: that one's whole
 * body is a comparison between two scores, and here there is no second score to
 * compare — being walked through the answer produced no number at all. Same
 * dashed treatment, because both are saying "this one does not count".
 */
export function NotScoredNotice() {
  return (
    <div className="rounded-md border border-dashed border-warning/40 bg-warning/5 px-3 py-2.5 text-sm">
      <div className="flex items-center gap-1.5 font-medium">
        <Trophy className="h-3.5 w-3.5 text-warning" /> Unranked — you were shown the answer
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Teacher mode worked this one through with you, so there is no score to rank. The board slot
        is still open: attempt this question cold and that result takes it.
      </p>
    </div>
  );
}

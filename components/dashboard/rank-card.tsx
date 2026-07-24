import { rankMeta, xpForLevel, type Rank } from "@/lib/config";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RankBadge } from "@/components/rank-badge";

export function RankCard({
  rank,
  percentile,
  xp,
  level,
}: {
  rank: string | null;
  percentile: number | null;
  xp: number;
  level: number;
}) {
  const meta = rankMeta[(rank ?? "Unranked") as Rank] ?? rankMeta.Unranked;
  const curLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const span = Math.max(1, nextLevelXp - curLevelXp);
  const pct = Math.min(100, Math.round(((xp - curLevelXp) / span) * 100));

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">Your rank</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-2xl" aria-hidden>{meta.emoji}</span>
            <span className="text-xl font-bold" style={{ color: meta.color }}>{meta.label}</span>
          </div>
        </div>
        <RankBadge rank={rank} showLabel={false} className="scale-125" />
      </div>
      {percentile != null && rank && rank !== "Unranked" ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Better than {percentile}% of learners (skill percentile).
        </p>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          Solve 5 graded questions to earn your rank.
        </p>
      )}

      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs">
          <span className="font-medium">Level {level}</span>
          <span className="text-muted-foreground">{xp} XP</span>
        </div>
        <Progress value={pct} />
        <p className="mt-1 text-right text-[11px] text-muted-foreground">
          {Math.max(0, nextLevelXp - xp)} XP to level {level + 1}
        </p>
      </div>
    </Card>
  );
}

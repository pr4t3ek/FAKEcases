import { rankMeta, type Rank } from "@/lib/config";
import { cn } from "@/lib/utils";

export function RankBadge({
  rank,
  className,
  showLabel = true,
}: {
  rank: string | null;
  className?: string;
  showLabel?: boolean;
}) {
  const key = (rank ?? "Unranked") as Rank;
  const meta = rankMeta[key] ?? rankMeta.Unranked;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        className,
      )}
      style={{ borderColor: `${meta.color}55`, color: meta.color }}
      title={`Rank: ${meta.label}`}
    >
      <span aria-hidden>{meta.emoji}</span>
      {showLabel && <span>{meta.label}</span>}
    </span>
  );
}

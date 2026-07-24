import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export interface AchievementView {
  slug: string;
  title: string;
  description: string;
  emoji: string;
  unlocked: boolean;
}

export function Achievements({ achievements }: { achievements: AchievementView[] }) {
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Achievements</h2>
        <span className="text-xs text-muted-foreground">
          {unlockedCount}/{achievements.length}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {achievements.map((a) => (
          <div
            key={a.slug}
            title={`${a.title} — ${a.description}`}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg border p-3 text-center",
              a.unlocked ? "bg-card" : "opacity-40 grayscale",
            )}
          >
            <span className="text-2xl" aria-hidden>{a.emoji}</span>
            <span className="text-[11px] font-medium leading-tight">{a.title}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

import { Target, TrendingUp, Activity, Flame, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";

export interface DashboardStats {
  totalSolved: number;
  avgScore: number;
  accuracy: number;
  consistency: number;
  streak: number;
}

const items = [
  { key: "totalSolved", label: "Solved", icon: CheckCircle2, suffix: "" },
  { key: "avgScore", label: "Avg score", icon: TrendingUp, suffix: "/100" },
  { key: "accuracy", label: "Accuracy", icon: Target, suffix: "%" },
  { key: "consistency", label: "Consistency", icon: Activity, suffix: "" },
  { key: "streak", label: "Streak", icon: Flame, suffix: "d" },
] as const;

export function StatCards({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((it) => (
        <Card key={it.key} className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <it.icon className="h-4 w-4" />
            <span className="text-xs">{it.label}</span>
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums">
            {stats[it.key]}
            <span className="text-sm font-normal text-muted-foreground">{it.suffix}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}

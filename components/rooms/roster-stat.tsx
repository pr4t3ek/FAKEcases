"use client";

import type { Users } from "lucide-react";
import { Card } from "@/components/ui/card";

/** One figure above a console's table. Shared by both boards, and identical. */
export function RosterStat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <div className="text-xl font-semibold tabular-nums">{value}</div>
        <div className="truncate text-xs text-muted-foreground">
          {label}
          {sub && ` · ${sub}`}
        </div>
      </div>
    </Card>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setFeedbackStatus } from "@/app/actions/admin";
import { FEEDBACK_TYPE_LABELS, FEEDBACK_STATUSES, type FeedbackType } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface AdminFeedback {
  id: string;
  type: string;
  message: string | null;
  status: string;
  createdAt: string;
  question: { title: string };
}

const statusVariant: Record<string, "warning" | "secondary" | "success" | "muted"> = {
  Open: "warning",
  Reviewing: "secondary",
  Resolved: "success",
  Dismissed: "muted",
};

export function FeedbackQueue({ feedback }: { feedback: AdminFeedback[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<string>("Open");

  const shown = feedback.filter((f) => filter === "All" || f.status === filter);

  async function update(id: string, status: string) {
    try {
      await setFeedbackStatus(id, status);
      toast.success(`Marked ${status}`);
      router.refresh();
    } catch {
      toast.error("Update failed");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {["All", ...FEEDBACK_STATUSES].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full border px-3 py-1 text-xs ${filter === s ? "border-primary bg-primary/5 text-primary" : "text-muted-foreground"}`}
          >
            {s}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No feedback in this view.</p>
      ) : (
        <Card className="divide-y">
          {shown.map((f) => (
            <div key={f.id} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={statusVariant[f.status] ?? "muted"}>{f.status}</Badge>
                    <Badge variant="outline">
                      {FEEDBACK_TYPE_LABELS[f.type as FeedbackType] ?? f.type}
                    </Badge>
                    <span className="truncate text-sm font-medium">{f.question.title}</span>
                  </div>
                  {f.message && <p className="mt-1 text-sm text-muted-foreground">{f.message}</p>}
                </div>
              </div>
              <div className="mt-2 flex gap-1.5">
                <Button size="sm" variant="outline" onClick={() => update(f.id, "Reviewing")}>Reviewing</Button>
                <Button size="sm" variant="outline" onClick={() => update(f.id, "Resolved")}>Resolve</Button>
                <Button size="sm" variant="ghost" onClick={() => update(f.id, "Dismissed")}>Dismiss</Button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

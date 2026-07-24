"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { FEEDBACK_TYPES, FEEDBACK_TYPE_LABELS } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ReportIssue({
  questionId,
  attemptId,
}: {
  questionId: string;
  attemptId: string;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>(FEEDBACK_TYPES[0]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ questionId, attemptId, type, message: message || undefined }),
      });
      if (!res.ok) throw new Error();
      toast.success("Thanks — we'll review this question.");
      setOpen(false);
      setMessage("");
    } catch {
      toast.error("Couldn't submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <Flag className="h-3 w-3" /> Report an issue
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report an issue with this question</DialogTitle>
          <DialogDescription>
            Spotted a wrong range, typo or unclear wording? Let us know.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {FEEDBACK_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                  type === t ? "border-primary bg-primary/5 text-primary" : "hover:bg-accent"
                }`}
              >
                {FEEDBACK_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Optional details…"
            maxLength={1000}
          />
          <div className="flex justify-end">
            <Button onClick={submit} disabled={submitting}>
              Submit report
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

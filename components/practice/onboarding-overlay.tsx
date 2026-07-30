"use client";

import { useState } from "react";
import { MessageSquareText, Layers, Calculator, ClipboardCheck, SearchCheck } from "lucide-react";
import { markOnboarded } from "@/app/actions/user";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { AnswerMode } from "@/lib/types";

const NUMERIC_POINTS = [
  { icon: MessageSquareText, title: "Think aloud in the chat", body: "The AI interviewer asks questions and guides you — it won't hand over the answer." },
  { icon: Calculator, title: "Use the tools on the left", body: "A framework builder and a scratchpad to structure your working, plus a calculator you can drag anywhere on screen." },
  { icon: Layers, title: "Track your progress on the right", body: "Your calculations, your framework and your final estimate — the numbers you put in the tree and say in chat are read as your assumptions, so there's no separate list to keep." },
  { icon: ClipboardCheck, title: "Submit for a scorecard", body: "Get an 8-category evaluation. The sample solution unlocks only after you submit." },
];

/**
 * A qualitative case is worked in a different order, so the welcome teaches that
 * order rather than a tour of the panels: ask first, then structure, then judge.
 * The old copy pointed at a right-hand panel that this mode collapses and a
 * final estimate it never asks for.
 */
const QUALITATIVE_POINTS = [
  { icon: MessageSquareText, title: "Ask before you structure", body: "Open by asking what you're solving for — the objective, the timeline, how the business makes money. A real interviewer expects that first." },
  { icon: Layers, title: "Break the problem into branches", body: "Build an issue tree on the left. Branches sit side by side, and anything you say in the chat can be pulled straight in as a branch." },
  { icon: SearchCheck, title: "Rule branches in or out", body: "Mark each branch as you check it. Clearing one folds it away; flagging one as the problem opens the next level, so you narrow until you reach the cause." },
  { icon: ClipboardCheck, title: "Land on a recommendation", body: "Write your answer under the tree and submit. You're scored on how you structured and narrowed the problem — not on arithmetic." },
];

export function OnboardingOverlay({ answerMode = "numeric" }: { answerMode?: AnswerMode }) {
  const [open, setOpen] = useState(true);
  const qualitative = answerMode === "qualitative";
  const points = qualitative ? QUALITATIVE_POINTS : NUMERIC_POINTS;

  function close() {
    setOpen(false);
    markOnboarded().catch(() => {});
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {qualitative ? "Welcome to your first case 👋" : "Welcome to your first guesstimate 👋"}
          </DialogTitle>
          <DialogDescription>
            Here&apos;s how it works — you&apos;ll get the hang of it in one go.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {points.map((p) => (
            <div key={p.title} className="flex gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <p.icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-medium">{p.title}</div>
                <div className="text-sm text-muted-foreground">{p.body}</div>
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={close} className="w-full sm:w-auto">Start practising</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

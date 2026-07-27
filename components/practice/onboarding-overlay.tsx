"use client";

import { useState } from "react";
import { MessageSquareText, Layers, Calculator, ClipboardCheck } from "lucide-react";
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

const POINTS = [
  { icon: MessageSquareText, title: "Think aloud in the chat", body: "The AI interviewer asks questions and guides you — it won't hand over the answer." },
  { icon: Calculator, title: "Use the tools on the left", body: "A framework builder and a scratchpad to structure your working, plus a calculator you can drag anywhere on screen." },
  { icon: Layers, title: "Track your progress on the right", body: "Your calculations, your framework and your final estimate — the numbers you put in the tree and say in chat are read as your assumptions, so there's no separate list to keep." },
  { icon: ClipboardCheck, title: "Submit for a scorecard", body: "Get an 8-category evaluation. The sample solution unlocks only after you submit." },
];

export function OnboardingOverlay() {
  const [open, setOpen] = useState(true);

  function close() {
    setOpen(false);
    markOnboarded().catch(() => {});
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Welcome to your first guesstimate 👋</DialogTitle>
          <DialogDescription>
            Here&apos;s how it works — you&apos;ll get the hang of it in one go.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {POINTS.map((p) => (
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

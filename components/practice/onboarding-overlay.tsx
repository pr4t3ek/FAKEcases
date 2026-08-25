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
import { WalkthroughPlayer } from "./walkthrough-player";
import type { DemoWalkthroughView } from "./types";
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

/**
 * The first-run welcome, and the door to the worked example.
 *
 * The walkthrough hangs off this modal rather than firing on its own, because
 * two things opening unprompted on a student's first screen is one too many —
 * they would dismiss whichever arrived second without reading it. One flow,
 * with the example as the primary action.
 *
 * `demo` is null whenever there is nothing published to show: no walkthrough
 * for the designated question, or the setting points at a question that no
 * longer exists. The modal then behaves exactly as it did before this feature.
 *
 * `onFinished` fires once this whole flow is over — the card dismissed, or the
 * walkthrough closed if they watched it. It is what lets the practice screen
 * run the tutorial tour AFTER the example instead of on top of it.
 */
export function OnboardingOverlay({
  answerMode = "numeric",
  demo = null,
  tourNext = false,
  onFinished,
}: {
  answerMode?: AnswerMode;
  demo?: DemoWalkthroughView | null;
  /** A tour follows this card, so the dismiss button says so instead of lying. */
  tourNext?: boolean;
  onFinished?: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [playing, setPlaying] = useState(false);
  const qualitative = answerMode === "qualitative";
  const points = qualitative ? QUALITATIVE_POINTS : NUMERIC_POINTS;

  // Offered on both exercises now. It used to be withheld from cases because the
  // only example was a guesstimate worked in numbers, which teaches nothing
  // about an issue tree scored on judgement — the page now loads the example
  // that matches the attempt's own answer mode, so the mismatch this guarded
  // against cannot arise. `demo` being null is still the ordinary "nothing
  // published for this kind" answer.
  const offerDemo = !!demo;

  function markSeen() {
    markOnboarded().catch(() => {});
  }

  function close() {
    setOpen(false);
    markSeen();
    onFinished?.();
  }

  function watch() {
    setOpen(false);
    setPlaying(true);
    markSeen();
    // Not finished yet — the walkthrough is the rest of this flow, and its
    // close is what reports back.
  }

  // The player is rendered here rather than through `WalkthroughButton` because
  // this path opens it WITHOUT a button being clicked. The button owns the same
  // player for every other entry point; this is the one that arrives on its own.
  if (playing && demo) {
    return (
      <WalkthroughPlayer
        title={demo.title}
        prompt={demo.prompt}
        unit={demo.unit}
        content={demo.content}
        onClose={() => {
          setPlaying(false);
          onFinished?.();
        }}
      />
    );
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
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant={offerDemo ? "outline" : "default"}
            onClick={close}
            className="w-full sm:w-auto"
          >
            {/* A button that promises the screen and then opens a tour has
                mis-sold it, so the label follows what actually happens next. */}
            {tourNext ? "Show me around" : offerDemo ? "I'll dive in" : "Start practising"}
          </Button>
          {offerDemo ? (
            <Button onClick={watch} className="w-full sm:w-auto">
              Show me one worked out
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

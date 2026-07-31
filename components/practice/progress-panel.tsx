"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { setFinalAnswer, setFinalEstimate } from "@/app/actions/practice";
import { submitAttempt, type SubmitResult } from "@/app/actions/submit";
import { evaluateExpression } from "@/lib/calc";
import type { AnswerMode } from "@/lib/types";
import { formatIndianNumber, toIndianWords, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { depthStyle } from "./framework-depth";
import type { UiCalculation, UiFrameworkNode } from "./types";

/**
 * Read-only nested rendering of a framework tree node and its children — the
 * same nested-box shape the builder uses, at panel scale so a deep tree still
 * fits this column.
 */
function FrameworkTreeItem({
  node,
  all,
  depth,
}: {
  node: UiFrameworkNode;
  all: UiFrameworkNode[];
  depth: number;
}) {
  const children = all.filter((n) => n.parentId === node.id);
  const tint = depthStyle(depth);
  // A qualitative node has no value to show, so the mirror carries its verdict
  // and its rationale instead — the two things that make the tree readable.
  const status = node.status ?? null;
  const detail = node.value?.trim() || node.note?.trim() || "";
  return (
    <div className={cn("space-y-1 rounded-lg border p-1", tint.box)}>
      <span className={cn("inline-block rounded border px-1.5 py-0.5", tint.chip)}>
        {/* Green is the problem branch here too — see framework-depth.ts. The
            mirror has to match the builder or the same tree reads two ways. */}
        {status === "problem" && (
          <span className="mr-1 text-emerald-600 dark:text-emerald-400">!</span>
        )}
        {status === "healthy" && <span className="mr-1 text-muted-foreground">OK</span>}
        {node.label}
        {detail ? ` — ${detail}` : ""}
      </span>
      {children.length > 0 && (
        // Half the builder's inset — same staircase, but this column is narrow.
        <div className="ml-1.5 space-y-1">
          {children.map((c) => (
            <FrameworkTreeItem key={c.id} node={c} all={all} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ProgressPanel({
  attemptId,
  unit,
  calculations,
  framework,
  estimateText,
  onEstimateTextChange,
  disabled,
  onSubmitted,
  answerMode = "numeric",
  answerText = "",
  onAnswerTextChange,
}: {
  attemptId: string;
  unit: string | null;
  calculations: UiCalculation[];
  framework: UiFrameworkNode[];
  estimateText: string;
  onEstimateTextChange: (t: string) => void;
  disabled: boolean;
  onSubmitted: (r: SubmitResult) => void;
  answerMode?: AnswerMode;
  answerText?: string;
  onAnswerTextChange?: (t: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const qualitative = answerMode === "qualitative";

  function commitEstimate() {
    const n = evaluateExpression(estimateText);
    setFinalEstimate(attemptId, n).catch(() => {});
  }
  function commitAnswer() {
    setFinalAnswer(attemptId, answerText).catch(() => {});
  }

  async function submit() {
    setSubmitting(true);
    try {
      // Persist the answer before asking for a verdict on it — the scorer reads
      // the row, not the component.
      if (qualitative) {
        await setFinalAnswer(attemptId, answerText).catch(() => {});
      } else {
        const n = evaluateExpression(estimateText);
        await setFinalEstimate(attemptId, n).catch(() => {});
      }
      const result = await submitAttempt(attemptId);
      if (!result.ok) throw new Error(result.error);
      onSubmitted(result);
    } catch {
      toast.error("Couldn't submit. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="scrollbar-thin flex-1 space-y-5 overflow-y-auto p-4">
        {/* Calculations summary — nothing to show without a calculator. */}
        <section hidden={qualitative}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Calculations ({calculations.length})
          </h3>
          {calculations.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Open the calculator above the tools to show your working.
            </p>
          ) : (
            <div className="space-y-1">
              {calculations.slice(-4).map((c) => (
                <div key={c.id} className="truncate rounded bg-muted/50 px-2 py-1 font-mono text-[11px]">
                  {c.expression} = {c.resultText}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Framework summary */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Framework
          </h3>
          {framework.length === 0 ? (
            <p className="text-xs text-muted-foreground">Build your estimation tree in Tools.</p>
          ) : (
            <div className="space-y-1 text-xs">
              {framework
                .filter((f) => f.parentId === null)
                .map((f) => (
                  <FrameworkTreeItem key={f.id} node={f} all={framework} depth={0} />
                ))}
            </div>
          )}
        </section>
      </div>

      {/* Final estimate + submit */}
      <div className="border-t p-4">
        <label
          data-tour="estimate"
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {qualitative ? "Final recommendation" : `Final estimate ${unit ? `(${unit})` : ""}`}
        </label>
        {qualitative ? (
          <Textarea
            value={answerText}
            onChange={(e) => onAnswerTextChange?.(e.target.value)}
            onBlur={commitAnswer}
            placeholder="What's your answer, and what would you do about it?"
            className="mb-3 min-h-[88px] text-sm"
            disabled={disabled}
          />
        ) : (
          <>
            <Input
              value={estimateText}
              onChange={(e) => onEstimateTextChange(e.target.value)}
              onBlur={commitEstimate}
              placeholder="e.g. 80L or 8000000"
              className="mb-1 font-mono"
              disabled={disabled}
            />
            {(() => {
              const n = evaluateExpression(estimateText);
              return n !== null ? (
                <p className="mb-3 text-xs text-muted-foreground">
                  = {formatIndianNumber(n)} · {toIndianWords(n)}
                </p>
              ) : (
                <div className="mb-3" />
              );
            })()}
          </>
        )}
        <Button
          data-tour="submit"
          className="w-full"
          onClick={submit}
          disabled={disabled || submitting}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Submit for evaluation
        </Button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          You&apos;ll get a full scorecard. The sample solution unlocks after you submit.
        </p>
      </div>
    </div>
  );
}

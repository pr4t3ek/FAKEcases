"use client";

import { useState } from "react";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addAssumption, deleteAssumption, setFinalEstimate } from "@/app/actions/practice";
import { submitAttempt, type SubmitResult } from "@/app/actions/submit";
import { evaluateExpression } from "@/lib/calc";
import { formatIndianNumber, toIndianWords, cn } from "@/lib/utils";
import { ASSUMPTION_RATING_META, type AssumptionRating } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { UiAssumption, UiCalculation, UiFrameworkNode } from "./types";

/** Read-only nested rendering of a framework tree node and its children. */
function FrameworkTreeItem({ node, all }: { node: UiFrameworkNode; all: UiFrameworkNode[] }) {
  const children = all.filter((n) => n.parentId === node.id);
  return (
    <div className="space-y-1">
      <span className="inline-block rounded bg-secondary px-1.5 py-0.5">
        {node.label}
        {node.value?.trim() ? `: ${node.value.trim()}` : ""}
      </span>
      {children.length > 0 && (
        <div className="ml-3 space-y-1 border-l border-dashed pl-2">
          {children.map((c) => (
            <FrameworkTreeItem key={c.id} node={c} all={all} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ProgressPanel({
  attemptId,
  unit,
  assumptions,
  onAssumptions,
  calculations,
  framework,
  estimateText,
  onEstimateTextChange,
  disabled,
  onSubmitted,
}: {
  attemptId: string;
  unit: string | null;
  assumptions: UiAssumption[];
  onAssumptions: (updater: (a: UiAssumption[]) => UiAssumption[]) => void;
  calculations: UiCalculation[];
  framework: UiFrameworkNode[];
  estimateText: string;
  onEstimateTextChange: (t: string) => void;
  disabled: boolean;
  onSubmitted: (r: SubmitResult) => void;
}) {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function add() {
    if (!value.trim()) return;
    const k = key.trim() || "Assumption";
    const v = value.trim();
    setKey("");
    setValue("");
    try {
      const created = await addAssumption(attemptId, k, v);
      onAssumptions((a) => [...a, created]);
    } catch {
      toast.error("Couldn't save assumption.");
    }
  }

  async function remove(id: string) {
    onAssumptions((a) => a.filter((x) => x.id !== id));
    deleteAssumption(id).catch(() => {});
  }

  function commitEstimate() {
    const n = evaluateExpression(estimateText);
    setFinalEstimate(attemptId, n).catch(() => {});
  }

  async function submit() {
    setSubmitting(true);
    try {
      // ensure latest estimate is persisted first
      const n = evaluateExpression(estimateText);
      await setFinalEstimate(attemptId, n).catch(() => {});
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
        {/* Assumptions */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Assumptions
          </h3>
          {!disabled && (
            <div className="mb-2 space-y-1.5">
              <Input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Label (e.g. Adults %)"
                className="h-8 text-xs"
              />
              <div className="flex gap-1.5">
                <Input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && add()}
                  placeholder="Value + rationale"
                  className="h-8 text-xs"
                />
                <Button size="icon" variant="secondary" className="h-8 w-8 shrink-0" onClick={add}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            {assumptions.length === 0 && (
              <p className="text-xs text-muted-foreground">None yet — log your key assumptions.</p>
            )}
            {assumptions.map((a) => {
              const meta = ASSUMPTION_RATING_META[a.rating as AssumptionRating];
              return (
                <div key={a.id} className="rounded-lg border p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium">{a.key}</div>
                      <div className="truncate text-xs text-muted-foreground">{a.value}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {meta && <Badge variant={meta.tone}>{meta.label}</Badge>}
                      {!disabled && (
                        <button
                          onClick={() => remove(a.id)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Remove assumption"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  {a.aiNote && <p className="mt-1 text-[11px] italic text-muted-foreground">{a.aiNote}</p>}
                </div>
              );
            })}
          </div>
        </section>

        {/* Calculations summary */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Calculations ({calculations.length})
          </h3>
          {calculations.length === 0 ? (
            <p className="text-xs text-muted-foreground">Use the calculator to show your working.</p>
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
                  <FrameworkTreeItem key={f.id} node={f} all={framework} />
                ))}
            </div>
          )}
        </section>
      </div>

      {/* Final estimate + submit */}
      <div className="border-t p-4">
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Final estimate {unit ? `(${unit})` : ""}
        </label>
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
        <Button className="w-full" onClick={submit} disabled={disabled || submitting}>
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

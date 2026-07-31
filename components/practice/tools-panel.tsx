"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Clock, Layers, Loader2, NotebookPen, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { saveTime, setFinalAnswer } from "@/app/actions/practice";
import { submitAttempt, type SubmitResult } from "@/app/actions/submit";
import { branchDiscussed, describeTrailLive, diagnosisTrail } from "@/lib/diagnosis";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { INTERVIEW_LEVEL_LABELS, type InterviewLevel, type TreeMode } from "@/lib/types";
import { CalculatorPopup } from "./calculator-popup";
import { FrameworkBuilder } from "./framework-builder";
import { ReportIssue } from "./report-issue";
import type { PracticeQuestion, UiCalculation, UiFrameworkNode } from "./types";

function fmt(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function ToolsPanel({
  attemptId,
  question,
  calculations,
  onAddCalc,
  framework,
  onFramework,
  onChainResult,
  initialTime,
  disabled,
  onActiveTool,
  activeTool,
  treeMode,
  messageText,
  conversation,
  answerText,
  onAnswerTextChange,
  onSubmitted,
}: {
  attemptId: string;
  question: PracticeQuestion;
  calculations: UiCalculation[];
  onAddCalc: (c: UiCalculation) => void;
  framework: UiFrameworkNode[];
  onFramework: (n: UiFrameworkNode[]) => void;
  onChainResult?: (n: number) => void;
  initialTime: number;
  disabled: boolean;
  onActiveTool: (tool: string) => void;
  activeTool: string;
  treeMode?: TreeMode | null;
  messageText?: Map<string, string>;
  /** Every turn in the conversation, for the "did you ask?" check. */
  conversation?: string[];
  answerText?: string;
  onAnswerTextChange?: (t: string) => void;
  onSubmitted?: (r: SubmitResult) => void;
}) {
  const qualitative = question.answerMode === "qualitative";
  /**
   * Branches given a verdict without ever being raised in the conversation.
   *
   * Only a judgement needs backing — adding, renaming and nesting branches are
   * hypotheses and never warn. And only on a question that has facts to ask
   * about, or a pure brainstorm case would nag on every mark.
   *
   * The test reads the transcript rather than the question's fact topics on
   * purpose: shipping those topics to the browser would tell the candidate which
   * branches have data behind them, and therefore which ones matter.
   */
  const unevidencedMarks =
    qualitative && question.hasDataPack
      ? framework
          .filter(
            (n) =>
              n.label.trim() &&
              n.status &&
              n.status !== "unknown" &&
              !branchDiscussed(n.label, conversation ?? []),
          )
          .map((n) => n.label.trim())
      : [];

  const [elapsed, setElapsed] = useState(initialTime);
  const [running, setRunning] = useState(!disabled);
  const [notes, setNotes] = useState("");

  // Load notes from localStorage (scratchpad is client-only).
  useEffect(() => {
    setNotes(localStorage.getItem(`eq-notes-${attemptId}`) ?? "");
  }, [attemptId]);

  // Timer tick + periodic persistence.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (disabled) return;
    const id = setInterval(() => saveTime(attemptId, elapsed).catch(() => {}), 15000);
    return () => clearInterval(id);
  }, [attemptId, elapsed, disabled]);

  return (
    <div className="flex h-full flex-col">
      {/* Question + timer */}
      <div className="border-b p-4" data-tour="question">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{question.category}</Badge>
          <Badge variant="outline">{question.difficulty}</Badge>
          <Badge variant="outline">
            {INTERVIEW_LEVEL_LABELS[question.interviewLevel as InterviewLevel] ??
              question.interviewLevel}
          </Badge>
        </div>
        <h1 className="text-base font-semibold leading-snug">{question.prompt}</h1>
        <div className="mt-3 flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 text-sm tabular-nums text-muted-foreground">
            <Clock className="h-4 w-4" />
            {fmt(elapsed)}
            {!disabled && (
              <button
                onClick={() => setRunning((r) => !r)}
                className="ml-1 text-muted-foreground hover:text-foreground"
                aria-label={running ? "Pause timer" : "Resume timer"}
              >
                {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* No arithmetic in a qualitative case, so no calculator. */}
            {!qualitative && (
              <CalculatorPopup
                attemptId={attemptId}
                calculations={calculations}
                onAdd={onAddCalc}
              />
            )}
            <ReportIssue questionId={question.id} attemptId={attemptId} />
          </div>
        </div>
      </div>

      {/* Tools */}
      <Tabs
        value={activeTool}
        className="flex flex-1 flex-col overflow-hidden"
        onValueChange={onActiveTool}
      >
        <div className="border-b px-3 py-2">
          <TabsList className="grid w-full grid-cols-2" data-tour="tools-tabs">
            <TabsTrigger value="framework">
              <Layers className="h-3.5 w-3.5" /> Framework
            </TabsTrigger>
            <TabsTrigger value="notes">
              <NotebookPen className="h-3.5 w-3.5" /> Notes
            </TabsTrigger>
          </TabsList>
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto p-4">
          <TabsContent value="framework" className="mt-0" data-tour="framework">
            <FrameworkBuilder
              attemptId={attemptId}
              nodes={framework}
              onChange={onFramework}
              onChainResult={onChainResult}
              answerMode={question.answerMode}
              treeMode={treeMode}
              hasDataPack={question.hasDataPack}
              messageText={messageText}
              conversation={conversation}
              questionFramework={question.framework}
            />
          </TabsContent>
          <TabsContent value="notes" className="mt-0">
            <Textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                localStorage.setItem(`eq-notes-${attemptId}`, e.target.value);
              }}
              placeholder="Scratchpad — jot your thinking here. (Saved on this device.)"
              className="min-h-[240px]"
            />
          </TabsContent>
        </div>
      </Tabs>

      {/* The answer moves under the tree, because the column it used to live in
          is now the tree's. */}
      {qualitative && onAnswerTextChange && onSubmitted && (
        <AnswerBar
          attemptId={attemptId}
          framework={framework}
          answerText={answerText ?? ""}
          onAnswerTextChange={onAnswerTextChange}
          disabled={disabled}
          onSubmitted={onSubmitted}
          unevidencedMarks={unevidencedMarks}
        />
      )}
    </div>
  );
}

/** Trail, recommendation and Submit in one strip under the builder. */
function AnswerBar({
  attemptId,
  framework,
  answerText,
  onAnswerTextChange,
  disabled,
  onSubmitted,
  unevidencedMarks,
}: {
  attemptId: string;
  framework: UiFrameworkNode[];
  answerText: string;
  onAnswerTextChange: (t: string) => void;
  disabled: boolean;
  onSubmitted: (r: SubmitResult) => void;
  /** Branches judged without ever being raised in the conversation. */
  unevidencedMarks: string[];
}) {
  const [submitting, setSubmitting] = useState(false);
  // The live variant: their marked path and nothing else. Counts and a
  // completeness verdict would tell them how much is left and when to stop,
  // which is the app doing the judging. Both appear on the report instead.
  const trail = describeTrailLive(diagnosisTrail(framework));
  const unevidenced = unevidencedMarks.length;

  async function submit() {
    setSubmitting(true);
    try {
      await setFinalAnswer(attemptId, answerText).catch(() => {});
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
    <div className="shrink-0 border-t bg-card/50 p-3">
      <p className="mb-2 truncate text-[11px] text-muted-foreground" title={trail}>
        {trail}
      </p>
      {/* A tally, never a block — the candidate may well be right, but an
          unchecked verdict should be on the record before they commit to it. */}
      {unevidenced > 0 && !disabled && (
        <p className="mb-2 flex items-start gap-1.5 text-[11px] text-warning">
          <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
          <span>
            {unevidenced} branch{unevidenced === 1 ? "" : "es"} marked without asking about
            {unevidenced === 1 ? " it" : " them"} — {unevidencedMarks.slice(0, 3).join(", ")}
            {unevidenced > 3 ? "…" : ""}
          </span>
        </p>
      )}
      <div className="flex items-end gap-2">
        <Textarea
          value={answerText}
          onChange={(e) => onAnswerTextChange(e.target.value)}
          onBlur={() => setFinalAnswer(attemptId, answerText).catch(() => {})}
          placeholder="Your recommendation — what's the answer, and what would you do?"
          className="max-h-28 min-h-[44px] flex-1 resize-none text-sm"
          disabled={disabled}
          data-tour="estimate"
        />
        <Button onClick={submit} disabled={disabled || submitting} className="shrink-0">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Submit
        </Button>
      </div>
    </div>
  );
}

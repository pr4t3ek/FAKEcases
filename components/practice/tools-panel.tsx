"use client";

import { useEffect, useRef, useState } from "react";
import { Calculator as CalcIcon, Clock, Layers, NotebookPen, Pause, Play } from "lucide-react";
import { saveTime } from "@/app/actions/practice";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { INTERVIEW_LEVEL_LABELS, type InterviewLevel } from "@/lib/types";
import { Calculator } from "./calculator";
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
}) {
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
      <div className="border-b p-4">
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
          <ReportIssue questionId={question.id} attemptId={attemptId} />
        </div>
      </div>

      {/* Tools */}
      <Tabs
        defaultValue="calculator"
        className="flex flex-1 flex-col overflow-hidden"
        onValueChange={onActiveTool}
      >
        <div className="border-b px-3 py-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="calculator">
              <CalcIcon className="h-3.5 w-3.5" /> Calc
            </TabsTrigger>
            <TabsTrigger value="framework">
              <Layers className="h-3.5 w-3.5" /> Framework
            </TabsTrigger>
            <TabsTrigger value="notes">
              <NotebookPen className="h-3.5 w-3.5" /> Notes
            </TabsTrigger>
          </TabsList>
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto p-4">
          <TabsContent value="calculator" className="mt-0">
            <Calculator attemptId={attemptId} calculations={calculations} onAdd={onAddCalc} />
          </TabsContent>
          <TabsContent value="framework" className="mt-0">
            <FrameworkBuilder
              attemptId={attemptId}
              nodes={framework}
              onChange={onFramework}
              onChainResult={onChainResult}
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
    </div>
  );
}

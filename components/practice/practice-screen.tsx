"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from "react-resizable-panels";
import { toast } from "sonner";
import { ArrowLeft, Clock, Minimize2, Pause, Play } from "lucide-react";
import { panelDefaults, treeFirstPanelDefaults, type AiMode } from "@/lib/config";
import { setFinalEstimate as persistFinalEstimate } from "@/app/actions/practice";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SubmitResult } from "@/app/actions/submit";
import { useMediaQuery } from "./use-media-query";
import { formatElapsed, useAttemptTimer } from "./use-attempt-timer";
import { AnswerBar, EstimateBar, ToolsPanel, unevidencedBranches } from "./tools-panel";
import { FrameworkBuilder } from "./framework-builder";
import { FloatingChat } from "./floating-chat";
import { ChatPanel } from "./chat-panel";
import { ProgressPanel } from "./progress-panel";
import { OnboardingOverlay } from "./onboarding-overlay";
import { TutorialTour } from "./tutorial-tour";
import type {
  PracticeData,
  UiCalculation,
  UiFrameworkNode,
  UiMessage,
} from "./types";

export function PracticeScreen({ data }: { data: PracticeData }) {
  const router = useRouter();
  const disabled = data.status === "submitted";
  const isWide = useMediaQuery("(min-width: 1024px)");

  const qualitative = data.question.answerMode === "qualitative";

  const [messages, setMessages] = useState<UiMessage[]>(data.messages);
  const [calculations, setCalculations] = useState<UiCalculation[]>(data.calculations);
  const [framework, setFramework] = useState<UiFrameworkNode[]>(data.framework);
  const [mode, setMode] = useState<AiMode>(data.mode);
  const [hintsUsed, setHintsUsed] = useState(data.hintsUsed);
  const [estimateText, setEstimateText] = useState(
    data.finalEstimate != null ? String(data.finalEstimate) : "",
  );
  const [answerText, setAnswerText] = useState(data.finalAnswer ?? "");

  // A node promoted from the chat shows the sentence it came from as its
  // rationale, so the builder needs to resolve message ids to their text.
  const messageText = new Map(messages.map((m) => [m.id, m.content]));

  const leftPanelRef = useRef<ImperativePanelHandle>(null);

  // Both tab groups are controlled here so the tutorial can reveal whichever
  // panel a step is anchored to — a synthetic click on a Radix trigger doesn't
  // activate it, and an inactive TabsContent isn't in the DOM to point at.
  const [mobileTab, setMobileTab] = useState("chat");
  const [activeTool, setActiveTool] = useState("framework");
  /**
   * Fullscreen is an in-app overlay, so every piece of state above stays put and
   * both chromes render from the same source — nothing to duplicate or sync.
   * Offered only where the canvas is: a case, on a wide screen.
   */
  const [fullscreen, setFullscreen] = useState(false);
  const canFullscreen = isWide && !disabled;

  /** Tutorial illustration branches. Render-only; never persisted or scored. */
  const [demoNodes, setDemoNodes] = useState<UiFrameworkNode[]>([]);
  /**
   * Whether the tour should open by itself.
   *
   * Once per ATTEMPT rather than per page load, so a mid-case refresh doesn't
   * replay it, and a candidate who has seen enough can switch it off for good.
   * Resolved in an effect because `localStorage` doesn't exist on the server and
   * reading it during render would hydrate wrong.
   */
  const [autoTour, setAutoTour] = useState(false);
  useEffect(() => {
    if (!qualitative || disabled) return;
    const seen = `eq-tour-seen-${data.attemptId}`;
    if (localStorage.getItem("eq-tour-off") || localStorage.getItem(seen)) return;
    localStorage.setItem(seen, "1");
    setAutoTour(true);
  }, [qualitative, disabled, data.attemptId]);

  const { elapsed, running, setRunning } = useAttemptTimer(
    data.attemptId,
    data.timeSpentSec,
    disabled,
  );

  useEffect(() => {
    if (!fullscreen) return;
    function onKey(e: KeyboardEvent) {
      // Radix stops Esc propagating while a dialog is open, so the delete
      // confirm closes first and fullscreen survives — the right order.
      if (e.key === "Escape") setFullscreen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const onActiveTool = useCallback(
    (tool: string) => {
      setActiveTool(tool);
      if (!isWide || !leftPanelRef.current) return;
      leftPanelRef.current.resize(
        tool === "framework" ? panelDefaults.frameworkExpandLeft : panelDefaults.left,
      );
    },
    [isWide],
  );

  const revealForTutorial = useCallback(
    (panel?: string, tool?: string) => {
      if (panel) setMobileTab(panel);
      if (tool) onActiveTool(tool);
    },
    [onActiveTool],
  );

  function handleAddCalc(c: UiCalculation) {
    setCalculations((prev) => {
      // replace optimistic temp entry if the real one arrives
      if (c.id.startsWith("tmp-")) return [...prev, c];
      const withoutTemp = prev.filter((x) => !(x.id.startsWith("tmp-") && x.expression === c.expression));
      return [...withoutTemp, c];
    });
  }

  function handleChainResult(n: number) {
    const rounded = Math.round(n * 100) / 100;
    setEstimateText(String(rounded));
    persistFinalEstimate(data.attemptId, rounded).catch(() => {});
  }

  function handleSubmitted(result: SubmitResult) {
    if (result.reward) {
      const r = result.reward;
      // A null overall is an attempt Teacher mode walked through: it earns XP
      // for the work but carries no score, so announcing one would be a lie
      // ("null/100" would be a worse one).
      const headline =
        r.overall == null
          ? "Submitted — not scored, you were shown the answer"
          : `Evaluated: ${r.overall}/100 · ${r.readiness}`;
      toast.success(
        `${headline}. +${r.xpGained} XP` + (r.leveledUp ? ` · Level ${r.level}!` : ""),
      );
      r.newAchievements.forEach((a) => toast(`🏅 Achievement unlocked: ${a}`));
    }
    router.refresh();
  }

  const conversation = messages.map((m) => m.content);
  const unevidencedMarks = qualitative
    ? unevidencedBranches(framework, conversation, data.question.hasDataPack)
    : [];

  const tools = (
    <ToolsPanel
      attemptId={data.attemptId}
      question={data.question}
      calculations={calculations}
      onAddCalc={handleAddCalc}
      framework={framework}
      onFramework={setFramework}
      onChainResult={handleChainResult}
      elapsed={elapsed}
      running={running}
      onRunningChange={setRunning}
      disabled={disabled}
      onActiveTool={onActiveTool}
      activeTool={activeTool}
      treeMode={data.treeMode}
      messageText={messageText}
      conversation={conversation}
      answerText={answerText}
      onAnswerTextChange={setAnswerText}
      onSubmitted={handleSubmitted}
      onFullscreen={canFullscreen ? () => setFullscreen(true) : undefined}
      demoNodes={demoNodes}
      estimateText={estimateText}
      onEstimateTextChange={setEstimateText}
    />
  );
  const chat = (
    <ChatPanel
      attemptId={data.attemptId}
      messages={messages}
      mode={mode}
      hintsUsed={hintsUsed}
      disabled={disabled}
      onMessages={setMessages}
      onMode={setMode}
      onHintsUsed={setHintsUsed}
    />
  );
  const progress = (
    <ProgressPanel
      attemptId={data.attemptId}
      unit={data.question.unit}
      calculations={calculations}
      framework={framework}
      estimateText={estimateText}
      onEstimateTextChange={setEstimateText}
      disabled={disabled}
      onSubmitted={handleSubmitted}
      answerMode={data.question.answerMode}
      answerText={answerText}
      onAnswerTextChange={setAnswerText}
    />
  );

  /**
   * Rendered outside the fullscreen branch on purpose. That branch returns
   * early, so anything inside it unmounts on the way in and REMOUNTS on the way
   * out — and this dialog owns its open state, so leaving fullscreen would pop
   * the welcome card back up every time.
   */
  const welcome = data.showOnboarding && !autoTour && (
    <OnboardingOverlay answerMode={data.question.answerMode} />
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-background">
        {welcome}
        <header className="flex h-12 shrink-0 items-center gap-3 border-b px-4">
          <h1 className="min-w-0 flex-1 truncate text-sm font-medium">{data.question.prompt}</h1>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-sm tabular-nums text-muted-foreground">
            <Clock className="h-4 w-4" />
            {formatElapsed(elapsed)}
            <button
              onClick={() => setRunning(!running)}
              className="ml-1 hover:text-foreground"
              aria-label={running ? "Pause timer" : "Resume timer"}
            >
              {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </button>
          </span>
          <button
            onClick={() => setFullscreen(false)}
            className="inline-flex shrink-0 items-center gap-1 rounded border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            title="Exit fullscreen (Esc)"
          >
            <Minimize2 className="h-3.5 w-3.5" /> Exit
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-hidden p-3">
          <FrameworkBuilder
            attemptId={data.attemptId}
            nodes={framework}
            onChange={setFramework}
            answerMode={data.question.answerMode}
            treeMode={data.treeMode}
            hasDataPack={data.question.hasDataPack}
            messageText={messageText}
            conversation={conversation}
            questionFramework={data.question.framework}
            onChainResult={handleChainResult}
            canvasFill
            // Same control, the other way round. The header's Exit stays as
            // well — it is the one a keyboard user tabs to first — but nobody
            // should have to hunt for the way out somewhere other than where
            // the way in was.
            onFullscreen={() => setFullscreen(false)}
            isFullscreen
            demoNodes={demoNodes}
          />
        </div>

        {qualitative ? (
          <AnswerBar
            attemptId={data.attemptId}
            framework={framework}
            answerText={answerText}
            onAnswerTextChange={setAnswerText}
            disabled={disabled}
            onSubmitted={handleSubmitted}
            unevidencedMarks={unevidencedMarks}
          />
        ) : (
          <EstimateBar
            attemptId={data.attemptId}
            unit={data.question.unit}
            estimateText={estimateText}
            onEstimateTextChange={setEstimateText}
            disabled={disabled}
            onSubmitted={handleSubmitted}
          />
        )}

        {/* The interviewer, as a window you can put wherever the tree isn't. */}
        <FloatingChat title="Interviewer">{chat}</FloatingChat>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* On a case the tour opens by itself and covers the same ground, so the
          welcome card would be a second modal stacked on the first. */}
      {welcome}
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3">
          <Link href="/library" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Brand href={data.isGuest ? "/library" : "/dashboard"} />
        </div>
        <div className="flex items-center gap-2">
          <TutorialTour
            onReveal={revealForTutorial}
            answerMode={data.question.answerMode}
            autoStart={autoTour}
            onDemo={setDemoNodes}
            onSuppressChange={(off) => off && localStorage.setItem("eq-tour-off", "1")}
          />
          {data.isGuest && (
            <Link href="/signup" className="text-xs font-medium text-primary hover:underline">
              Sign up to save progress
            </Link>
          )}
          <ThemeToggle />
        </div>
      </header>

      {isWide ? (
        <PanelGroup direction="horizontal" autoSaveId="eq-practice-panels" className="flex-1">
          {/* The framework builder is the tools panel's default tab, so the
              left panel opens at the width that tool expects. */}
          <Panel
            ref={leftPanelRef}
            defaultSize={treeFirstPanelDefaults.left}
            minSize={22}
            order={1}
          >
            {tools}
          </Panel>
          {/* A 10px grab area around a 6px line. The divider used to be 6px of
              hit area sitting flush against a panel's scrollbar, so aiming at
              one and catching the other was a coin toss — the scroll containers
              now keep a gutter clear of it, and the target you are aiming at is
              centred in something wider than itself. */}
          <PanelResizeHandle className="group relative w-2.5 shrink-0">
            <div className="pointer-events-none absolute inset-y-0 left-1/2 w-1.5 -translate-x-1/2 bg-border transition-colors group-hover:bg-primary/40 group-data-[resize-handle-state=drag]:bg-primary" />
          </PanelResizeHandle>
          <Panel
            defaultSize={treeFirstPanelDefaults.center}
            minSize={28}
            order={2}
          >
            {chat}
          </Panel>
          {/* A 10px grab area around a 6px line. The divider used to be 6px of
              hit area sitting flush against a panel's scrollbar, so aiming at
              one and catching the other was a coin toss — the scroll containers
              now keep a gutter clear of it, and the target you are aiming at is
              centred in something wider than itself. */}
          <PanelResizeHandle className="group relative w-2.5 shrink-0">
            <div className="pointer-events-none absolute inset-y-0 left-1/2 w-1.5 -translate-x-1/2 bg-border transition-colors group-hover:bg-primary/40 group-data-[resize-handle-state=drag]:bg-primary" />
          </PanelResizeHandle>
          {/* A tree needs the width more than a summary of itself does, so this
              starts collapsed — collapsed, not removed: the handle pulls it back
              open for anyone who wants the mirror. */}
          <Panel
            defaultSize={treeFirstPanelDefaults.right}
            minSize={0}
            collapsible
            collapsedSize={0}
            order={3}
          >
            {progress}
          </Panel>
        </PanelGroup>
      ) : (
        <Tabs
          value={mobileTab}
          onValueChange={setMobileTab}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <TabsList className="m-2 grid grid-cols-3">
            <TabsTrigger value="tools" data-tour="mobile-tab-tools">Tools</TabsTrigger>
            <TabsTrigger value="chat" data-tour="mobile-tab-chat">Chat</TabsTrigger>
            <TabsTrigger value="progress" data-tour="mobile-tab-progress">Progress</TabsTrigger>
          </TabsList>
          <TabsContent value="tools" className="flex-1 overflow-hidden">{tools}</TabsContent>
          <TabsContent value="chat" className="flex-1 overflow-hidden">{chat}</TabsContent>
          <TabsContent value="progress" className="flex-1 overflow-hidden">{progress}</TabsContent>
        </Tabs>
      )}
    </div>
  );
}

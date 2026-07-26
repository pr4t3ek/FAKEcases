"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from "react-resizable-panels";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { panelDefaults, type AiMode } from "@/lib/config";
import { setFinalEstimate as persistFinalEstimate } from "@/app/actions/practice";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SubmitResult } from "@/app/actions/submit";
import { ToolsPanel } from "./tools-panel";
import { ChatPanel } from "./chat-panel";
import { ProgressPanel } from "./progress-panel";
import { OnboardingOverlay } from "./onboarding-overlay";
import type {
  PracticeData,
  UiAssumption,
  UiCalculation,
  UiFrameworkNode,
  UiMessage,
} from "./types";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    setMatches(m.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    m.addEventListener("change", handler);
    return () => m.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

export function PracticeScreen({ data }: { data: PracticeData }) {
  const router = useRouter();
  const disabled = data.status === "submitted";
  const isWide = useMediaQuery("(min-width: 1024px)");

  const [messages, setMessages] = useState<UiMessage[]>(data.messages);
  const [assumptions, setAssumptions] = useState<UiAssumption[]>(data.assumptions);
  const [calculations, setCalculations] = useState<UiCalculation[]>(data.calculations);
  const [framework, setFramework] = useState<UiFrameworkNode[]>(data.framework);
  const [mode, setMode] = useState<AiMode>(data.mode);
  const [hintsUsed, setHintsUsed] = useState(data.hintsUsed);
  const [estimateText, setEstimateText] = useState(
    data.finalEstimate != null ? String(data.finalEstimate) : "",
  );

  const leftPanelRef = useRef<ImperativePanelHandle>(null);

  const onActiveTool = useCallback(
    (tool: string) => {
      if (!isWide || !leftPanelRef.current) return;
      leftPanelRef.current.resize(
        tool === "framework" ? panelDefaults.frameworkExpandLeft : panelDefaults.left,
      );
    },
    [isWide],
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
      toast.success(
        `Evaluated: ${r.overall}/100 · ${r.readiness}. +${r.xpGained} XP` +
          (r.leveledUp ? ` · Level ${r.level}!` : ""),
      );
      r.newAchievements.forEach((a) => toast(`🏅 Achievement unlocked: ${a}`));
    }
    router.refresh();
  }

  const tools = (
    <ToolsPanel
      attemptId={data.attemptId}
      question={data.question}
      calculations={calculations}
      onAddCalc={handleAddCalc}
      framework={framework}
      onFramework={setFramework}
      onChainResult={handleChainResult}
      initialTime={data.timeSpentSec}
      disabled={disabled}
      onActiveTool={onActiveTool}
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
      assumptions={assumptions}
      onAssumptions={setAssumptions}
      calculations={calculations}
      framework={framework}
      estimateText={estimateText}
      onEstimateTextChange={setEstimateText}
      disabled={disabled}
      onSubmitted={handleSubmitted}
    />
  );

  return (
    <div className="flex h-screen flex-col">
      {data.showOnboarding && <OnboardingOverlay />}
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3">
          <Link href="/library" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Brand href={data.isGuest ? "/library" : "/dashboard"} />
        </div>
        <div className="flex items-center gap-2">
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
          <Panel ref={leftPanelRef} defaultSize={panelDefaults.left} minSize={22} order={1}>
            {tools}
          </Panel>
          <PanelResizeHandle className="w-1.5 bg-border transition-colors hover:bg-primary/40" />
          <Panel defaultSize={panelDefaults.center} minSize={28} order={2}>
            {chat}
          </Panel>
          <PanelResizeHandle className="w-1.5 bg-border transition-colors hover:bg-primary/40" />
          <Panel defaultSize={panelDefaults.right} minSize={16} order={3}>
            {progress}
          </Panel>
        </PanelGroup>
      ) : (
        <Tabs defaultValue="chat" className="flex flex-1 flex-col overflow-hidden">
          <TabsList className="m-2 grid grid-cols-3">
            <TabsTrigger value="tools">Tools</TabsTrigger>
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="progress">Progress</TabsTrigger>
          </TabsList>
          <TabsContent value="tools" className="flex-1 overflow-hidden">{tools}</TabsContent>
          <TabsContent value="chat" className="flex-1 overflow-hidden">{chat}</TabsContent>
          <TabsContent value="progress" className="flex-1 overflow-hidden">{progress}</TabsContent>
        </Tabs>
      )}
    </div>
  );
}

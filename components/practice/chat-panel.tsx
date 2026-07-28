"use client";

import { useEffect, useRef, useState } from "react";
import { Lightbulb, Loader2, SendHorizontal, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { aiModes, hintConfig, type AiMode } from "@/lib/config";
import { readNdjson } from "@/lib/llm/stream";
import { setMode as persistMode } from "@/app/actions/practice";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { UiMessage } from "./types";

/** Any mock-produced turn is badged so a degraded answer is never mistaken for the real one. */
function isMockProvider(provider?: string | null): boolean {
  return Boolean(provider?.startsWith("mock"));
}

export function ChatPanel({
  attemptId,
  messages,
  mode,
  hintsUsed,
  disabled,
  onMessages,
  onMode,
  onHintsUsed,
}: {
  attemptId: string;
  messages: UiMessage[];
  mode: AiMode;
  hintsUsed: number;
  disabled: boolean;
  onMessages: (updater: (m: UiMessage[]) => UiMessage[]) => void;
  onMode: (m: AiMode) => void;
  onHintsUsed: (n: number) => void;
}) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  /** True until the first delta lands, so the spinner only covers real dead air. */
  const [awaitingFirstToken, setAwaitingFirstToken] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, awaitingFirstToken]);

  function patch(id: string, fn: (m: UiMessage) => UiMessage) {
    onMessages((all) => all.map((m) => (m.id === id ? fn(m) : m)));
  }

  /**
   * POST to a streaming route and render its deltas into a single assistant bubble.
   *
   * The bubble is created empty up front and filled as text arrives, so the reply
   * appears progressively instead of after a multi-second spinner.
   */
  async function stream(
    url: string,
    payload: Record<string, unknown>,
    { seed = "", hintLevel = null }: { seed?: string; hintLevel?: number | null } = {},
  ): Promise<{ hintsUsed?: number } | null> {
    const id = `a-${Date.now()}`;
    let received = false;

    setBusy(true);
    setAwaitingFirstToken(true);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Pre-stream rejections (auth, validation, ownership) are still plain JSON.
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Request failed");
      }

      onMessages((all) => [
        ...all,
        { id, role: "assistant", content: seed, hintLevel, streaming: true },
      ]);

      let result: { hintsUsed?: number } | null = null;

      for await (const line of readNdjson(res)) {
        if (line.t === "delta") {
          if (!received) {
            received = true;
            setAwaitingFirstToken(false);
          }
          patch(id, (m) => ({ ...m, content: m.content + line.v }));
        } else if (line.t === "error") {
          patch(id, (m) => ({ ...m, interrupted: true }));
          toast.error(
            line.code === "quota_exhausted"
              ? "The interviewer is out of capacity for today."
              : "The interviewer was cut off mid-answer.",
          );
        } else if (line.t === "done") {
          patch(id, (m) => ({ ...m, provider: line.provider, streaming: false }));
          result = { hintsUsed: line.hintsUsed };
        }
      }

      if (!received) {
        // Stream closed without producing anything — drop the empty bubble.
        onMessages((all) => all.filter((m) => m.id !== id));
        throw new Error("Empty response");
      }

      return result;
    } catch {
      if (received) {
        patch(id, (m) => ({ ...m, streaming: false, interrupted: true }));
      } else {
        onMessages((all) => all.filter((m) => m.id !== id));
      }
      return null;
    } finally {
      setBusy(false);
      setAwaitingFirstToken(false);
    }
  }

  async function send(content: string, useMode: AiMode) {
    if (!content.trim() || busy) return;
    onMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", content }]);

    const result = await stream("/api/chat", { attemptId, content, mode: useMode });
    if (!result) toast.error("The interviewer couldn't respond. Try again.");
  }

  async function onSubmit() {
    const content = input.trim();
    if (!content) return;
    setInput("");
    await send(content, mode);
  }

  async function changeMode(next: AiMode) {
    if (next === mode) return;
    onMode(next);
    persistMode(attemptId, next).catch(() => {});
    if (next === "teacher") {
      await send("Please walk me through how a consultant would approach this.", "teacher");
    }
  }

  async function requestHint() {
    if (busy) return;
    const level = Math.min(hintsUsed + 1, hintConfig.levels);

    const result = await stream(
      "/api/hint",
      { attemptId, level },
      { seed: `💡 Hint ${level}: `, hintLevel: level },
    );

    if (!result) {
      toast.error("Couldn't fetch a hint.");
      return;
    }
    if (typeof result.hintsUsed === "number") onHintsUsed(result.hintsUsed);
  }

  const hintsExhausted = hintsUsed >= hintConfig.levels;

  return (
    <div className="flex h-full flex-col">
      {/* Mode switch */}
      <div className="flex items-center gap-1 border-b p-2" data-tour="modes">
        {aiModes.map((m) => (
          <button
            key={m.key}
            onClick={() => changeMode(m.key)}
            title={m.hint}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              mode === m.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="scrollbar-thin flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            The interviewer is ready. Share how you&apos;d approach this.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm",
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : m.hintLevel
                    ? "border border-warning/40 bg-warning/10"
                    : "bg-muted",
              )}
            >
              {m.content}
              {m.streaming && <span className="ml-0.5 animate-pulse">▍</span>}

              {m.role === "assistant" && !m.streaming && isMockProvider(m.provider) && (
                <span
                  className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground"
                  title="Answered by the built-in offline interviewer, not the AI model."
                >
                  <WifiOff className="h-3 w-3" />
                  offline interviewer
                </span>
              )}
              {m.interrupted && (
                <span className="mt-1.5 block text-[11px] text-destructive">
                  Cut off — send another message to continue.
                </span>
              )}
            </div>
          </div>
        ))}
        {awaitingFirstToken && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl bg-muted px-3.5 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> thinking…
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t p-3">
        <div className="mb-2 flex items-center justify-between" data-tour="hint">
          <Button
            variant="outline"
            size="sm"
            onClick={hintsExhausted ? () => changeMode("teacher") : requestHint}
            disabled={busy || disabled}
          >
            <Lightbulb className="h-3.5 w-3.5" />
            {hintsExhausted ? "Explain (Teacher)" : `Hint ${Math.min(hintsUsed + 1, hintConfig.levels)}`}
          </Button>
          <span className="text-xs text-muted-foreground">
            Hints used: {hintsUsed}/{hintConfig.levels}
          </span>
        </div>
        <div className="flex items-end gap-2" data-tour="composer">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit();
              }
            }}
            placeholder={disabled ? "This attempt is submitted." : "Think aloud… (Enter to send)"}
            className="max-h-32 min-h-[44px] resize-none"
            disabled={busy || disabled}
          />
          <Button size="icon" onClick={onSubmit} disabled={busy || disabled || !input.trim()}>
            <SendHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Lightbulb, Loader2, SendHorizontal } from "lucide-react";
import { toast } from "sonner";
import { aiModes, hintConfig, type AiMode } from "@/lib/config";
import { setMode as persistMode } from "@/app/actions/practice";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { UiMessage } from "./types";

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
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(content: string, useMode: AiMode) {
    if (!content.trim() || busy) return;
    setBusy(true);
    onMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", content }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ attemptId, content, mode: useMode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onMessages((m) => [...m, { id: `a-${Date.now()}`, role: "assistant", content: data.reply }]);
    } catch {
      toast.error("The interviewer couldn't respond. Try again.");
    } finally {
      setBusy(false);
    }
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
    setBusy(true);
    try {
      const res = await fetch("/api/hint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ attemptId, level }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onMessages((m) => [
        ...m,
        { id: `h-${Date.now()}`, role: "assistant", content: `💡 Hint ${level}: ${data.hint}`, hintLevel: level },
      ]);
      onHintsUsed(data.hintsUsed);
    } catch {
      toast.error("Couldn't fetch a hint.");
    } finally {
      setBusy(false);
    }
  }

  const hintsExhausted = hintsUsed >= hintConfig.levels;

  return (
    <div className="flex h-full flex-col">
      {/* Mode switch */}
      <div className="flex items-center gap-1 border-b p-2">
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
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl bg-muted px-3.5 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> thinking…
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t p-3">
        <div className="mb-2 flex items-center justify-between">
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
        <div className="flex items-end gap-2">
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

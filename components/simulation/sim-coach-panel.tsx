"use client";

import { useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { readNdjson } from "@/lib/llm/stream";
import { cn } from "@/lib/utils";
import { AssistantText } from "@/components/practice/assistant-text";
import { SpeakButton } from "@/components/practice/speak-button";
import { useSpeechOutput } from "@/components/practice/use-speech-output";

interface CoachMessage {
  role: "user" | "assistant";
  content: string;
  provider?: string | null;
  streaming?: boolean;
}

const SUGGESTIONS = [
  "Why didn't my fix work?",
  "What should I have looked at first?",
  "What did the discount actually cost?",
];

/**
 * Ask the coach.
 *
 * Strictly an extra: the authored debrief above it is the product, and this
 * panel is what makes it conversational. With no API key the same questions are
 * still answered — from the scenario's authored coach answers via the mock —
 * which is why there is no "unavailable" state to design around.
 */
export function SimCoachPanel({ runId, available }: { runId: string; available: boolean }) {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const { supported: canSpeak, speakingId, toggle: toggleSpeech } = useSpeechOutput();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;

    setInput("");
    setBusy(true);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: question },
      { role: "assistant", content: "", streaming: true },
    ]);

    try {
      const res = await fetch("/api/sim-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, content: question }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setMessages((prev) =>
          prev.map((m, i) =>
            i === prev.length - 1
              ? { ...m, streaming: false, content: body?.error ?? "The coach is unavailable." }
              : m,
          ),
        );
        return;
      }

      let text = "";
      let provider: string | null = null;
      for await (const line of readNdjson(res)) {
        if (line.t === "delta") {
          text += line.v;
          setMessages((prev) =>
            prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: text } : m)),
          );
        } else if (line.t === "done") {
          provider = line.provider ?? null;
        }
      }
      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, streaming: false, content: text, provider } : m,
        ),
      );
    } catch {
      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1
            ? { ...m, streaming: false, content: "The coach couldn't be reached." }
            : m,
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <MessageCircle className="h-4 w-4 text-primary" /> Ask the coach
        {!available && (
          <Badge variant="muted" className="ml-1">
            offline
          </Badge>
        )}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        The debrief above is the answer. This is for the follow-up question it didn&apos;t cover.
      </p>

      {messages.length > 0 && (
        <div className="mt-4 space-y-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "rounded-lg px-3 py-2 text-sm",
                m.role === "user"
                  ? "ml-8 bg-primary/10"
                  : "mr-8 bg-muted/50 text-muted-foreground",
              )}
            >
              {m.role === "assistant" ? (
                <AssistantText>{m.content}</AssistantText>
              ) : (
                m.content
              )}
              {!m.content && m.streaming && "…"}
              {m.role === "assistant" && m.provider?.startsWith("mock") && !m.streaming && (
                <Badge variant="muted" className="ml-2">
                  offline coach
                </Badge>
              )}

              {/* Click-to-play only. The auto-speak toggle lives on the practice
                  chat, which is a mock interview; a debrief is read, not sat. */}
              {m.role === "assistant" && !m.streaming && m.content && (
                <div className="-mb-1 mt-0.5 flex justify-end">
                  <SpeakButton
                    supported={canSpeak}
                    speaking={speakingId === `coach-${i}`}
                    onToggle={() => toggleSpeech(`coach-${i}`, m.content)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {messages.length === 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ask(s)}
              disabled={busy}
              className="rounded-full border px-3 py-1 text-xs transition-colors hover:bg-accent"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about anything in this run…"
          disabled={busy}
        />
        <Button type="submit" size="icon" disabled={busy || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </Card>
  );
}

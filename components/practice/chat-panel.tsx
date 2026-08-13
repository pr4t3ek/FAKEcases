"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, Lightbulb, Loader2, Pause, Play, SendHorizontal, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { aiModes, hintConfig, transcriptFor, type AiMode } from "@/lib/config";
import { readNdjson } from "@/lib/llm/stream";
import { setMode as persistMode } from "@/app/actions/practice";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { DictationButton } from "./dictation-button";
import { AssistantText } from "./assistant-text";
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
  /**
   * Teacher mode states the answer and is charged for at submit, so the switch is
   * confirmed rather than instant. Asked once: having accepted the cost, being
   * re-prompted on every switch back would be nagging, not informing.
   */
  const [confirmingTeacher, setConfirmingTeacher] = useState(false);
  const [teacherAccepted, setTeacherAccepted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  /**
   * Holding the text still while you read it.
   *
   * A long Teacher answer arrives faster than anyone reads, and there was no way
   * to stop it. Pausing holds the *rendering*: deltas keep arriving and go into a
   * buffer, and resuming flushes them in one go. The model carries on either way
   * — this is a reader's control, not a cancel — so nothing is lost by pausing
   * and the answer is complete whenever you come back to it.
   */
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const bufferRef = useRef("");
  const streamingIdRef = useRef<string | null>(null);

  /**
   * Interrupting an answer to ask something else.
   *
   * Paused, the composer opens: reading half an answer and realising you wanted
   * to ask a different thing is exactly when you want to type. Sending then
   * abandons the turn in flight — the question you just asked is the one you
   * want answered, and letting the old reply carry on would leave the panel
   * writing about something nobody is waiting for any more.
   *
   * `busyRef` shadows `busy` because the replacement send happens in the same
   * tick as the abort, before React has re-rendered — a guard reading state
   * would still see the cancelled turn as running and refuse the new one.
   * `runRef` is what stops the cancelled turn's `finally` from clearing flags
   * the replacement has already set.
   */
  const abortRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const runRef = useRef(0);

  function setBusyNow(value: boolean) {
    busyRef.current = value;
    setBusy(value);
  }

  function cancelStream() {
    if (!busyRef.current) return;
    // Cleared before the abort so the aborted turn's `finally` flush is a no-op:
    // text held back and never shown, for a question that has been withdrawn,
    // should not surface underneath the new answer.
    bufferRef.current = "";

    // Mark the abandoned turn here rather than leaving it to the aborted fetch's
    // rejection. That rejection does arrive, but it races the replacement turn
    // this function exists to make room for, and a half-answer left without its
    // "cut off" note reads as though it simply stopped mid-sentence.
    const abandoned = streamingIdRef.current;
    if (abandoned) {
      patch(abandoned, (m) =>
        m.content.trim() ? { ...m, streaming: false, interrupted: true } : m,
      );
    }

    abortRef.current?.abort();
    abortRef.current = null;
    streamingIdRef.current = null;
    pausedRef.current = false;
    setPaused(false);
    setBusyNow(false);
  }

  /**
   * Whether the transcript is following the newest text.
   *
   * The autoscroll used to fire on every token unconditionally, so scrolling up
   * during a long answer was pointless: the next delta yanked you back to the
   * bottom, which is the "scroll doesn't work" complaint. Now it only follows
   * while you are already at the bottom, and stepping away detaches it until you
   * come back — by scrolling down yourself or with the button.
   */
  const [atBottom, setAtBottom] = useState(true);
  const atBottomRef = useRef(true);

  function stickToBottom(behavior: ScrollBehavior = "auto") {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    // A threshold rather than an exact match: sub-pixel layout and the growing
    // last bubble mean "at the bottom" is never exactly zero.
    const near = el.scrollHeight - el.scrollTop - el.clientHeight <= 64;
    atBottomRef.current = near;
    setAtBottom(near);
  }

  // Read from the ref, so this fires on new text and not when the flag flips —
  // and `auto` rather than `smooth`, because a smooth scroll emits its own
  // scroll events mid-animation, which `onScroll` would read as the user
  // stepping away and switch following off after the first token.
  useEffect(() => {
    if (atBottomRef.current) stickToBottom();
  }, [messages, awaitingFirstToken]);

  function patch(id: string, fn: (m: UiMessage) => UiMessage) {
    onMessages((all) => all.map((m) => (m.id === id ? fn(m) : m)));
  }

  /** Empty the pause buffer into the bubble it belongs to. */
  function flushBuffer() {
    const pending = bufferRef.current;
    const id = streamingIdRef.current;
    bufferRef.current = "";
    if (pending && id) patch(id, (m) => ({ ...m, content: m.content + pending }));
  }

  function togglePause() {
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
    if (!next) flushBuffer();
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
    {
      seed = "",
      hintLevel = null,
      turnMode,
    }: { seed?: string; hintLevel?: number | null; turnMode: string },
    // `superseded` is how a turn says "I was replaced on purpose" — distinct
    // from null, which means it genuinely failed and the student should be told.
  ): Promise<{ hintsUsed?: number; superseded?: boolean } | null> {
    const id = `a-${Date.now()}`;
    const run = ++runRef.current;
    const controller = new AbortController();
    let received = false;

    abortRef.current = controller;
    streamingIdRef.current = id;
    setBusyNow(true);
    setAwaitingFirstToken(true);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      // Pre-stream rejections (auth, validation, ownership) are still plain JSON.
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Request failed");
      }

      onMessages((all) => [
        ...all,
        { id, role: "assistant", content: seed, hintLevel, mode: turnMode, streaming: true },
      ]);

      let result: { hintsUsed?: number } | null = null;

      for await (const line of readNdjson(res)) {
        if (line.t === "delta") {
          if (!received) {
            received = true;
            setAwaitingFirstToken(false);
          }
          // Paused holds the text, it does not drop it — the stream is still
          // being read, so nothing arrives out of order when it resumes.
          if (pausedRef.current) bufferRef.current += line.v;
          else patch(id, (m) => ({ ...m, content: m.content + line.v }));
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

      if (runRef.current !== run) return { superseded: true };
      return result;
    } catch {
      // Aborted to make room for a newer question, not broken.
      if (runRef.current !== run) return { superseded: true };
      if (received) {
        patch(id, (m) => ({ ...m, streaming: false, interrupted: true }));
      } else {
        onMessages((all) => all.filter((m) => m.id !== id));
      }
      return null;
    } finally {
      // Only if this is still the turn in flight. A cancelled one finishes AFTER
      // its replacement has started, and would otherwise clear the new turn's
      // flags and leave the panel looking idle while text is still arriving.
      if (runRef.current === run) {
        // Whatever the outcome, anything held back belongs on screen: the answer
        // is finished, so there is nothing left for a pause to protect.
        flushBuffer();
        pausedRef.current = false;
        setPaused(false);
        streamingIdRef.current = null;
        setBusyNow(false);
        setAwaitingFirstToken(false);
        abortRef.current = null;
      }
    }
  }

  async function send(content: string, useMode: AiMode) {
    if (!content.trim() || busyRef.current) return;
    onMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", content, mode: useMode }]);

    const result = await stream(
      "/api/chat",
      { attemptId, content, mode: useMode },
      { turnMode: useMode },
    );
    // Null means it failed; a superseded turn returns a marker instead, so
    // replacing your own question never reports an error.
    if (!result) toast.error("The interviewer couldn't respond. Try again.");
  }

  async function onSubmit() {
    const content = input.trim();
    if (!content) return;
    // Asking while it is still writing replaces the answer in flight.
    cancelStream();
    setInput("");
    await send(content, mode);
  }

  async function changeMode(next: AiMode) {
    if (next === mode) return;
    // Gate the one mode that hands over the answer; every other switch is free.
    if (next === "teacher" && !teacherAccepted) {
      setConfirmingTeacher(true);
      return;
    }
    onMode(next);
    persistMode(attemptId, next).catch(() => {});
    if (next === "teacher") {
      await send("Please walk me through how a consultant would approach this.", "teacher");
    }
  }

  async function acceptTeacher() {
    setConfirmingTeacher(false);
    setTeacherAccepted(true);
    onMode("teacher");
    persistMode(attemptId, "teacher").catch(() => {});
    await send("Please walk me through how a consultant would approach this.", "teacher");
  }

  async function requestHint() {
    if (busy) return;
    const level = Math.min(hintsUsed + 1, hintConfig.levels);

    const result = await stream(
      "/api/hint",
      { attemptId, level },
      // `coach` is what /api/hint stores, and `transcriptFor` files it under the
      // interview — which is where it was asked for.
      { seed: `💡 Hint ${level}: `, hintLevel: level, turnMode: "coach" },
    );

    if (!result) {
      toast.error("Couldn't fetch a hint.");
      return;
    }
    if (typeof result.hintsUsed === "number") onHintsUsed(result.hintsUsed);
  }

  const hintsExhausted = hintsUsed >= hintConfig.levels;

  /**
   * Only this mode's conversation. Asking the Teacher used to drop its answer
   * into the interview as well, so switching back showed the solution you had
   * just been handed. See `transcriptFor` for why a hint counts as interview.
   */
  const visible = messages.filter((m) => transcriptFor(m.mode) === transcriptFor(mode));

  /** Paused, the composer opens — see `cancelStream`. */
  const composerLocked = disabled || (busy && !paused);

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
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="scrollbar-thin scroll-gutter relative flex-1 space-y-3 overflow-y-auto p-4"
      >
        {visible.length === 0 && (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            The interviewer is ready. Share how you&apos;d approach this.
          </p>
        )}
        {visible.map((m) => (
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
              {/* Only the assistant's text is normalised. A student who types
                  `**` meant `**`, and rewriting what someone said back at them
                  is a different thing entirely. */}
              {m.role === "assistant" ? <AssistantText>{m.content}</AssistantText> : m.content}
              {m.streaming &&
                (paused ? (
                  <span className="ml-1 rounded bg-foreground/10 px-1.5 py-0.5 text-[11px] font-medium">
                    paused
                  </span>
                ) : (
                  <span className="ml-0.5 animate-pulse">▍</span>
                ))}

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
            {/* Not "Explain" — the next step after the hints run out is the answer
                itself, and it costs. Naming it that way is the honest default. */}
            {hintsExhausted
              ? "Reveal solution (costs marks)"
              : `Hint ${Math.min(hintsUsed + 1, hintConfig.levels)}`}
          </Button>
          <span className="text-xs text-muted-foreground">
            Hints used: {hintsUsed}/{hintConfig.levels}
          </span>
        </div>
        {/* Scrolled away from the newest text. The transcript stops following
            while you are up here, so this is how you re-attach it — the same
            bargain as the canvas's "Back to the tree". */}
        {!atBottom && (
          <div className="mb-2 flex justify-center">
            <button
              type="button"
              onClick={() => {
                atBottomRef.current = true;
                setAtBottom(true);
                stickToBottom("smooth");
              }}
              className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium shadow-sm hover:bg-muted"
            >
              <ArrowDown className="h-3.5 w-3.5" />
              {busy ? "Jump to the latest — it's still writing" : "Jump to the latest"}
            </button>
          </div>
        )}
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
            placeholder={
              disabled
                ? "This attempt is submitted."
                : paused
                  ? "Ask something else — this replaces the answer above"
                  : "Think aloud… (Enter to send)"
            }
            className="max-h-32 min-h-[44px] resize-none"
            disabled={composerLocked}
          />
          <DictationButton onValueChange={setInput} disabled={composerLocked} />
          {/* While it is writing, the send button has nothing to do — you cannot
              send anyway — so its place goes to the one control you might
              actually want mid-answer. */}
          {/* Paused offers both: carry on with this answer, or replace it with a
              new question. Anything else would make one of the two a guess about
              which the student meant. */}
          {busy && !paused && (
            <Button
              size="icon"
              variant="secondary"
              onClick={togglePause}
              aria-label="Pause the answer"
              title="Pause the text so you can read it. The answer keeps being written."
            >
              <Pause className="h-4 w-4" />
            </Button>
          )}
          {busy && paused && (
            <Button
              size="icon"
              variant="secondary"
              onClick={togglePause}
              aria-label="Resume the answer"
              title="Resume — the text held back appears at once"
            >
              <Play className="h-4 w-4" />
            </Button>
          )}
          {(!busy || paused) && (
            <Button
              size="icon"
              onClick={onSubmit}
              disabled={disabled || !input.trim()}
              aria-label={paused ? "Ask this instead" : "Send"}
              title={paused ? "Ask this instead — the answer above is abandoned" : "Send"}
            >
              <SendHorizontal className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <Dialog
        open={confirmingTeacher}
        onOpenChange={(open) => !open && setConfirmingTeacher(false)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogTitle>Have the solution explained?</DialogTitle>
          <DialogDescription>
            Teacher mode works the whole problem through, so your Confidence score
            is reduced — about the same as using every hint. Your evaluation will
            say it happened. You can always retry the question cold for a clean
            score.
          </DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmingTeacher(false)}>
              Keep trying
            </Button>
            <Button onClick={acceptTeacher} disabled={busy}>
              Explain it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

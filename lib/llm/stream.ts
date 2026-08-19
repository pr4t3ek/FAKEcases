/**
 * The wire protocol between the chat/hint routes and the practice UI.
 *
 * Newline-delimited JSON rather than SSE: it needs no `EventSource` (so the
 * client keeps using `fetch` and keeps sending a JSON body), and it carries the
 * trailing metadata — provider, model, hintsUsed — that the old single-shot JSON
 * response returned.
 *
 * This module is imported by both the routes and a client component, so it must
 * stay free of server-only imports. Everything here is web-standard.
 */

import type { LlmErrorCode } from "./errors";

/** Why something other than the configured provider answered. */
export type FallbackReason = "quota" | "error" | "budget";

/**
 * How `runTurn` labels an engine that stood in for the configured provider, and
 * how the chat components read that label back.
 *
 * It lives here rather than next to `runTurn` for the reason the module docstring
 * gives: `./index` imports every adapter, Gemini's SDK included, and none of that
 * belongs in a client bundle. The producer and its two readers still share one
 * definition of the shape, which is the point — a turn shown as the real provider
 * when a stand-in answered it would be a quiet lie about where the answer came from.
 */
const FALLBACK_SUFFIX = " (fallback)";

export function fallbackLabel(name: string): string {
  return `${name}${FALLBACK_SUFFIX}`;
}

/** Any mock-produced turn: the offline interviewer answered, not a model. */
export function isMockProvider(provider?: string | null): boolean {
  return Boolean(provider?.startsWith("mock"));
}

/** The real engine that stood in for the configured provider, when one did. */
export function fallbackEngine(provider?: string | null): string | null {
  if (!provider || isMockProvider(provider)) return null;
  if (!provider.endsWith(FALLBACK_SUFFIX)) return null;
  return provider.slice(0, -FALLBACK_SUFFIX.length);
}

export type StreamLine =
  /** An incremental chunk of assistant text. */
  | { t: "delta"; v: string }
  /** Terminal line. Always sent last, including after an `error` line. */
  | {
      t: "done";
      provider: string;
      model?: string;
      fallbackReason?: FallbackReason;
      hintsUsed?: number;
      level?: number;
      /**
       * Turns left on this attempt after the one just served, or null when the
       * per-attempt budget is disabled. Sent on the stream rather than fetched
       * separately so the composer's counter cannot lag the gate that enforces it.
       */
      remaining?: number | null;
    }
  /** The turn failed or was cut short. May follow deltas (partial answer). */
  | { t: "error"; code: LlmErrorCode | "interrupted"; message?: string };

export function encodeLine(line: StreamLine): string {
  return `${JSON.stringify(line)}\n`;
}

function safeParse(raw: string): StreamLine | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && "t" in parsed) {
      return parsed as StreamLine;
    }
  } catch {
    // A truncated or malformed line is dropped rather than killing the stream.
  }
  return null;
}

/**
 * Wrap an async generator of protocol lines in a streaming `Response`.
 *
 * `no-transform` and `x-accel-buffering: no` matter in production: without them
 * an intermediate proxy is free to buffer the whole body and deliver it at once,
 * which silently turns streaming back into the single-shot behaviour it replaced.
 */
export function ndjsonResponse(lines: () => AsyncGenerator<StreamLine>): Response {
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const line of lines()) {
          controller.enqueue(encoder.encode(encodeLine(line)));
        }
      } catch (err) {
        console.error("[llm] stream producer failed:", err);
        try {
          controller.enqueue(
            encoder.encode(encodeLine({ t: "error", code: "provider_error" })),
          );
        } catch {
          // Consumer already went away — nothing useful left to do.
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store, no-transform",
      "x-accel-buffering": "no",
    },
  });
}

/** Read a streaming response body as protocol lines. Client-side counterpart. */
export async function* readNdjson(res: Response): AsyncGenerator<StreamLine> {
  const reader = res.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const raw = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!raw) continue;
        const line = safeParse(raw);
        if (line) yield line;
      }
    }

    // A final line with no trailing newline (e.g. a truncated stream).
    const rest = buffer.trim();
    if (rest) {
      const line = safeParse(rest);
      if (line) yield line;
    }
  } finally {
    reader.releaseLock();
  }
}

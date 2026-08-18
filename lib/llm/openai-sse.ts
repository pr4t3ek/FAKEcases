/**
 * Reading text deltas out of an OpenAI-style SSE body.
 *
 * Shared rather than duplicated: every OpenAI-compatible provider streams the
 * same `data:`-prefixed frames with the same `[DONE]` sentinel, so the line
 * handling belongs in one place. `ollama.ts` (a local server) and `nvidia.ts` (a
 * hosted one) both read it, and a fix to the frame handling has to land for both
 * or neither.
 *
 * Separate from `./stream`, which is the app's own NDJSON protocol between the
 * route handler and the browser. This one is the wire format on the way in.
 */

interface StreamChunk {
  choices?: { delta?: { content?: string } }[];
}

/**
 * Pull text deltas out of an OpenAI-style SSE body.
 *
 * Exported on its own so the line handling — `data:` prefixes, the `[DONE]`
 * sentinel, and events straddling a chunk boundary — can be tested without a
 * server. A malformed line is skipped rather than thrown on, matching
 * `safeParse()` in `./stream`: one bad frame shouldn't kill a turn that is
 * otherwise streaming fine.
 */
export async function* parseSseDeltas(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  function* linesFrom(text: string): Generator<string> {
    buffer += text;
    let newline: number;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) yield line;
    }
  }

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      for (const line of linesFrom(decoder.decode(value, { stream: true }))) {
        if (!line.startsWith("data:")) continue;

        const payload = line.slice(5).trim();
        if (payload === "[DONE]") return;

        let chunk: StreamChunk;
        try {
          chunk = JSON.parse(payload) as StreamChunk;
        } catch {
          continue;
        }

        const text = chunk.choices?.[0]?.delta?.content;
        if (text) yield text;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

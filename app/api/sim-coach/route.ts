import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { loadSimCoachContext } from "@/lib/simulation-context";
import { interviewerReplyStream, isRealProvider } from "@/lib/llm";
import { checkBudget, recordLlmCall } from "@/lib/llm/budget";
import { ndjsonResponse, type StreamLine } from "@/lib/llm/stream";

const schema = z.object({
  runId: z.string(),
  content: z.string().min(1).max(2000),
});

export async function POST(req: Request) {
  // Everything that can fail before the stream opens answers with plain JSON,
  // so the client can tell "request rejected" from "turn went wrong midway" —
  // the same contract as /api/chat.
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { runId, content } = parsed.data;
  const loaded = await loadSimCoachContext(runId);
  if (!loaded || loaded.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // The coach is told the answer, so it must not be reachable while the run is
  // still being played. Without this it would be the cheapest drilldown in the
  // game — and free.
  if (loaded.phase !== "debrief") {
    return NextResponse.json(
      { error: "The coach is available once the quarter is committed" },
      { status: 409 },
    );
  }

  await db.simMessage.create({ data: { runId, role: "user", content } });

  const budget = await checkBudget(user.id);
  const turn = interviewerReplyStream(loaded.ctx, { budgetBlocked: !budget.ok });

  return ndjsonResponse(async function* (): AsyncGenerator<StreamLine> {
    let text = "";

    for await (const delta of turn.deltas) {
      text += delta;
      yield { t: "delta", v: delta };
    }

    const { provider, model, fallbackReason, interrupted } = turn.outcome;

    // Persist before closing the stream, not after: work scheduled past the end
    // of the response body can be cut short on serverless, losing the turn.
    if (text) {
      await db.simMessage.create({
        data: { runId, role: "assistant", content: text, provider, model },
      });
      if (isRealProvider(provider)) await recordLlmCall();
    }

    if (interrupted) yield { t: "error", code: interrupted };
    yield { t: "done", provider, model, fallbackReason };
  });
}

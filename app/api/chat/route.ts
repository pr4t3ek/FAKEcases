import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { loadInterviewerContext } from "@/lib/practice-context";
import { interviewerReplyStream, isRealProvider } from "@/lib/llm";
import { checkBudget, recordLlmCall } from "@/lib/llm/budget";
import { ndjsonResponse, type StreamLine } from "@/lib/llm/stream";
import { aiModes, type SelectableMode } from "@/lib/config";
import type { AiMode } from "@/lib/config";

const schema = z.object({
  attemptId: z.string(),
  content: z.string().min(1).max(4000),
  // Only what the picker offers. Removing a button that the route still honours
  // is decoration — Coach handed out hints without touching `hintsUsed`, which
  // is exactly the sort of thing a hand-rolled request would go looking for.
  mode: z
    .enum(aiModes.map((m) => m.key) as [SelectableMode, ...SelectableMode[]])
    .default("interviewer"),
});

export async function POST(req: Request) {
  // Everything that can fail before the stream opens answers with plain JSON, so
  // the client can distinguish "request rejected" from "turn went wrong midway".
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { attemptId, content, mode } = parsed.data;

  const attempt = await db.attempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Persist the user's message, then generate the interviewer's reply.
  await db.message.create({
    data: { attemptId, role: "user", mode, content },
  });

  const loaded = await loadInterviewerContext(attemptId, mode as AiMode);
  if (!loaded) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const budget = await checkBudget(user.id);
  const turn = interviewerReplyStream(loaded.ctx, { budgetBlocked: !budget.ok });

  return ndjsonResponse(async function* (): AsyncGenerator<StreamLine> {
    let text = "";

    for await (const delta of turn.deltas) {
      text += delta;
      yield { t: "delta", v: delta };
    }

    const { provider, model, fallbackReason, interrupted } = turn.outcome;

    // Persist before closing the stream, not after: work scheduled past the end of
    // the response body can be cut short on serverless, losing the turn.
    if (text) {
      await db.message.create({
        data: { attemptId, role: "assistant", mode, content: text, provider, model },
      });
      await db.attempt.update({ where: { id: attemptId }, data: { mode } });
      if (isRealProvider(provider)) await recordLlmCall();
    }

    if (interrupted) yield { t: "error", code: interrupted };
    yield { t: "done", provider, model, fallbackReason };
  });
}

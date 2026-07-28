import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { loadInterviewerContext } from "@/lib/practice-context";
import { interviewerHintStream, isRealProvider } from "@/lib/llm";
import { checkBudget, recordLlmCall } from "@/lib/llm/budget";
import { ndjsonResponse, type StreamLine } from "@/lib/llm/stream";
import { hintConfig } from "@/lib/config";

const schema = z.object({
  attemptId: z.string(),
  level: z.number().int().min(1).max(hintConfig.levels),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { attemptId, level } = parsed.data;
  const attempt = await db.attempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const loaded = await loadInterviewerContext(attemptId);
  if (!loaded) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const budget = await checkBudget(user.id);
  const turn = interviewerHintStream(loaded.ctx, level, { budgetBlocked: !budget.ok });
  const hintsUsed = Math.max(attempt.hintsUsed, level);

  return ndjsonResponse(async function* (): AsyncGenerator<StreamLine> {
    let text = "";

    for await (const delta of turn.deltas) {
      text += delta;
      yield { t: "delta", v: delta };
    }

    const { provider, model, fallbackReason, interrupted } = turn.outcome;

    // The "💡 Hint N:" prefix is stored with the message but not streamed — the
    // client already rendered it when it created the bubble.
    if (text) {
      await db.message.create({
        data: {
          attemptId,
          role: "assistant",
          mode: "coach",
          content: `💡 Hint ${level}: ${text}`,
          hintLevel: level,
          provider,
          model,
        },
      });
      await db.attempt.update({ where: { id: attemptId }, data: { hintsUsed } });
      if (isRealProvider(provider)) await recordLlmCall();
    }

    if (interrupted) yield { t: "error", code: interrupted };
    yield { t: "done", provider, model, fallbackReason, hintsUsed, level };
  });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { loadInterviewerContext } from "@/lib/practice-context";
import { interviewerHint } from "@/lib/llm";
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

  const { content: hint, provider } = await interviewerHint(loaded.ctx, level);

  const hintsUsed = Math.max(attempt.hintsUsed, level);
  await db.message.create({
    data: {
      attemptId,
      role: "assistant",
      mode: "coach",
      content: `💡 Hint ${level}: ${hint}`,
      hintLevel: level,
    },
  });
  await db.attempt.update({ where: { id: attemptId }, data: { hintsUsed } });

  return NextResponse.json({ hint, level, hintsUsed, provider });
}

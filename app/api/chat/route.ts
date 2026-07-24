import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { loadInterviewerContext } from "@/lib/practice-context";
import { interviewerReply } from "@/lib/llm";
import type { AiMode } from "@/lib/config";

const schema = z.object({
  attemptId: z.string(),
  content: z.string().min(1).max(4000),
  mode: z.enum(["interviewer", "coach", "teacher", "evaluator"]).default("interviewer"),
});

export async function POST(req: Request) {
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

  const { content: reply, provider } = await interviewerReply(loaded.ctx);

  await db.message.create({
    data: { attemptId, role: "assistant", mode, content: reply },
  });
  await db.attempt.update({ where: { id: attemptId }, data: { mode } });

  return NextResponse.json({ reply, provider });
}

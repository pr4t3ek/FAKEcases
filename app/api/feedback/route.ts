import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { FEEDBACK_TYPES } from "@/lib/types";
import { createLimiter } from "@/lib/rate-limit";

const schema = z.object({
  questionId: z.string(),
  attemptId: z.string().optional(),
  type: z.enum(FEEDBACK_TYPES),
  message: z.string().max(1000).optional(),
});

// Per user/guest, best-effort. The limiter itself now lives in lib/rate-limit,
// shared with the classroom join form — see the note there about it being
// in-memory and therefore per-process.
const limiter = createLimiter({ windowMs: 60_000, max: 5 });

export async function POST(req: Request) {
  const user = await getSessionUser();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  if (!limiter.check(user?.id ?? "anon").ok) {
    return NextResponse.json({ error: "Too many reports, please slow down." }, { status: 429 });
  }

  const question = await db.question.findUnique({ where: { id: parsed.data.questionId } });
  if (!question) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.questionFeedback.create({
    data: {
      questionId: parsed.data.questionId,
      attemptId: parsed.data.attemptId,
      userId: user?.id,
      type: parsed.data.type,
      message: parsed.data.message,
    },
  });

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { FEEDBACK_TYPES } from "@/lib/types";

const schema = z.object({
  questionId: z.string(),
  attemptId: z.string().optional(),
  type: z.enum(FEEDBACK_TYPES),
  message: z.string().max(1000).optional(),
});

// Very small in-memory rate limiter (per user/guest, best-effort).
const lastByUser = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

export async function POST(req: Request) {
  const user = await getSessionUser();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const key = user?.id ?? "anon";
  const now = Date.now();
  const hits = (lastByUser.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) {
    return NextResponse.json({ error: "Too many reports, please slow down." }, { status: 429 });
  }
  hits.push(now);
  lastByUser.set(key, hits);

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

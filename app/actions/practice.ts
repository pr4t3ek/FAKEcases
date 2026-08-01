"use server";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { frameworkSchema, type FrameworkNodePayload } from "@/lib/framework-payload";
import type { AiMode } from "@/lib/config";

async function assertOwner(attemptId: string): Promise<string> {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  const attempt = await db.attempt.findUnique({ where: { id: attemptId }, select: { userId: true } });
  if (!attempt || attempt.userId !== user.id) throw new Error("Not found");
  return user.id;
}

export async function addCalculation(
  attemptId: string,
  expression: string,
  result: number | null,
  resultText: string,
) {
  await assertOwner(attemptId);
  const created = await db.calculation.create({
    data: { attemptId, expression, result, resultText },
  });
  return { id: created.id, expression: created.expression, resultText: created.resultText };
}

/**
 * Full-replace the framework tree. Client generates stable ids so parent/child
 * links survive the replace; parentId is linked in a second pass so every row
 * exists before any self-referencing FK is set.
 *
 * All three statements share one transaction. Split across separate calls, a
 * failure anywhere after the delete left the candidate with no tree at all —
 * the one outcome an autosave must never produce.
 */
export async function saveFramework(attemptId: string, nodes: FrameworkNodePayload[]) {
  await assertOwner(attemptId);
  const parsed = frameworkSchema.parse(nodes);

  await db.$transaction(async (tx) => {
    await tx.frameworkNode.deleteMany({ where: { attemptId } });
    if (!parsed.length) return;

    await tx.frameworkNode.createMany({
      data: parsed.map((n, i) => ({
        id: n.id,
        attemptId,
        label: n.label,
        value: n.value ?? null,
        multiplier: n.multiplier ?? null,
        combine: n.combine,
        status: n.status ?? null,
        note: n.note ?? null,
        sourceMessageId: n.sourceMessageId ?? null,
        origin: n.origin ?? null,
        order: i,
      })),
    });

    for (const n of parsed.filter((n) => n.parentId)) {
      await tx.frameworkNode.update({ where: { id: n.id }, data: { parentId: n.parentId } });
    }
  });
}

export async function setMode(attemptId: string, mode: AiMode) {
  await assertOwner(attemptId);
  await db.attempt.update({ where: { id: attemptId }, data: { mode } });
}

export async function setFinalEstimate(attemptId: string, value: number | null) {
  await assertOwner(attemptId);
  await db.attempt.update({ where: { id: attemptId }, data: { finalEstimate: value } });
}

/** The recommendation in words — the qualitative counterpart of a final estimate. */
export async function setFinalAnswer(attemptId: string, text: string) {
  await assertOwner(attemptId);
  await db.attempt.update({
    where: { id: attemptId },
    data: { finalAnswer: text.trim() || null },
  });
}

export async function saveTime(attemptId: string, seconds: number) {
  await assertOwner(attemptId);
  await db.attempt.update({
    where: { id: attemptId },
    data: { timeSpentSec: Math.max(0, Math.round(seconds)) },
  });
}

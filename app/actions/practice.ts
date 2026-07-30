"use server";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
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

/** Full-replace the framework tree. Client generates stable ids so parent/child
 * links survive the replace; parentId is linked in a second pass so every row
 * exists before any self-referencing FK is set. */
export async function saveFramework(
  attemptId: string,
  nodes: {
    id: string;
    parentId: string | null;
    label: string;
    value?: string | null;
    multiplier?: string | null;
    combine: "sum" | "multiply";
    status?: string | null;
    note?: string | null;
    sourceMessageId?: string | null;
    origin?: string | null;
  }[],
) {
  await assertOwner(attemptId);
  await db.frameworkNode.deleteMany({ where: { attemptId } });
  if (nodes.length) {
    await db.frameworkNode.createMany({
      data: nodes.map((n, i) => ({
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
    const withParent = nodes.filter((n) => n.parentId);
    if (withParent.length) {
      await db.$transaction(
        withParent.map((n) =>
          db.frameworkNode.update({ where: { id: n.id }, data: { parentId: n.parentId } }),
        ),
      );
    }
  }
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

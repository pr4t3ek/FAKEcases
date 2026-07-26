"use server";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { rateAssumption } from "@/lib/evaluation";
import type { AiMode } from "@/lib/config";

async function assertOwner(attemptId: string): Promise<string> {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  const attempt = await db.attempt.findUnique({ where: { id: attemptId }, select: { userId: true } });
  if (!attempt || attempt.userId !== user.id) throw new Error("Not found");
  return user.id;
}

export async function addAssumption(attemptId: string, key: string, value: string) {
  await assertOwner(attemptId);
  const { rating, note } = rateAssumption(key, value);
  const created = await db.assumption.create({
    data: { attemptId, key: key.trim() || "Assumption", value: value.trim(), rating, aiNote: note },
  });
  return {
    id: created.id,
    key: created.key,
    value: created.value,
    rating: created.rating,
    aiNote: created.aiNote,
  };
}

export async function deleteAssumption(id: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  const a = await db.assumption.findUnique({ where: { id }, include: { attempt: true } });
  if (!a || a.attempt.userId !== user.id) throw new Error("Not found");
  await db.assumption.delete({ where: { id } });
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

export async function saveTime(attemptId: string, seconds: number) {
  await assertOwner(attemptId);
  await db.attempt.update({
    where: { id: attemptId },
    data: { timeSpentSec: Math.max(0, Math.round(seconds)) },
  });
}

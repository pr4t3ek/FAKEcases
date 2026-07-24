"use server";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function markOnboarded(): Promise<void> {
  const user = await getSessionUser();
  if (!user || user.onboardedAt) return;
  await db.user.update({ where: { id: user.id }, data: { onboardedAt: new Date() } });
}

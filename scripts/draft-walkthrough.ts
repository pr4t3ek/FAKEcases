/**
 * Draft a worked example from a question's own sample solution.
 *
 *   npx tsx scripts/draft-walkthrough.ts chai-bangalore-daily
 *   npx tsx scripts/draft-walkthrough.ts --all
 *
 * Output is always a DRAFT. It is a head start on typing, not content: every
 * `say` and `because` comes out as a TODO for a human to write, because the one
 * thing a parser cannot recover from "≈ 85 lakh" is *why* two in three people
 * drink tea — and that sentence is the entire value of a worked example.
 *
 * Nothing here can reach a student. `lib/walkthrough.ts` serves only published
 * rows, and `publishWalkthrough` refuses a chain that misses the question's
 * authored range.
 */

import { PrismaClient } from "@prisma/client";
import { draftFromSampleSolution } from "@/lib/walkthrough/draft";
import { validateWalkthrough } from "@/lib/walkthrough/validate";

async function main() {
  const db = new PrismaClient();
  const arg = process.argv[2];

  if (!arg) {
    console.error("Usage: npx tsx scripts/draft-walkthrough.ts <externalId> | --all");
    process.exit(1);
  }

  const questions = await db.question.findMany({
    where: {
      type: "guesstimate",
      ...(arg === "--all" ? {} : { externalId: arg }),
      idealLow: { not: null },
      idealHigh: { not: null },
    },
    select: {
      id: true,
      externalId: true,
      title: true,
      sampleSolution: true,
      idealLow: true,
      idealHigh: true,
    },
  });

  if (questions.length === 0) {
    console.error(`No guesstimate with an ideal range matched "${arg}".`);
    process.exit(1);
  }

  let drafted = 0;
  let skipped = 0;

  for (const q of questions) {
    const content = draftFromSampleSolution({
      title: q.title,
      sampleSolution: q.sampleSolution,
    });

    if (!content) {
      console.log(`  – ${q.externalId}: not enough figures in the sample solution`);
      skipped += 1;
      continue;
    }

    await db.walkthrough.upsert({
      where: { questionId: q.id },
      create: {
        questionId: q.id,
        stepsJson: JSON.stringify(content),
        status: "draft",
        source: "llm",
      },
      update: { stepsJson: JSON.stringify(content), status: "draft", source: "llm" },
    });

    const check = validateWalkthrough(content, {
      idealLow: q.idealLow,
      idealHigh: q.idealHigh,
    });
    const verdict = check.ok
      ? "arithmetic already checks out"
      : (check.issues[0]?.message ?? "needs work");
    console.log(`  ✓ ${q.externalId}: ${content.steps.length} steps — ${verdict}`);
    drafted += 1;
  }

  console.log(`\nDrafted ${drafted}, skipped ${skipped}.`);
  console.log("All of them are DRAFTS. Write the prose and publish from Admin → Examples.");
  await db.$disconnect();
}

main();

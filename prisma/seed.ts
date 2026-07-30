import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";
import { categories, questions, achievements } from "./seed-data";

const db = new PrismaClient();

async function main() {
  console.log("🌱 Seeding EstimateIQ (India-only content)…");

  // Categories
  const categoryBySlug = new Map<string, string>();
  for (const c of categories) {
    const cat = await db.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, icon: c.icon, order: c.order },
      create: { slug: c.slug, name: c.name, icon: c.icon, order: c.order },
    });
    categoryBySlug.set(c.slug, cat.id);
  }
  console.log(`  ✓ ${categories.length} categories`);

  // Questions (upsert by externalId)
  for (const q of questions) {
    const categoryId = categoryBySlug.get(q.category);
    if (!categoryId) throw new Error(`Unknown category slug: ${q.category}`);
    await db.question.upsert({
      where: { externalId: q.externalId },
      update: {
        title: q.title,
        prompt: q.prompt,
        categoryId,
        difficulty: q.difficulty,
        interviewLevel: q.interviewLevel,
        idealLow: q.idealLow ?? null,
        idealHigh: q.idealHigh ?? null,
        unit: q.unit ?? null,
        betterApproach: q.betterApproach,
        sampleSolution: q.sampleSolution,
        tags: q.tags,
        type: q.type ?? "guesstimate",
        framework: q.framework ?? null,
        source: "seed",
      },
      create: {
        externalId: q.externalId,
        title: q.title,
        prompt: q.prompt,
        categoryId,
        difficulty: q.difficulty,
        interviewLevel: q.interviewLevel,
        idealLow: q.idealLow ?? null,
        idealHigh: q.idealHigh ?? null,
        unit: q.unit ?? null,
        betterApproach: q.betterApproach,
        sampleSolution: q.sampleSolution,
        tags: q.tags,
        type: q.type ?? "guesstimate",
        framework: q.framework ?? null,
        source: "seed",
      },
    });
  }
  console.log(`  ✓ ${questions.length} India-only questions`);

  // Achievements
  for (const a of achievements) {
    await db.achievement.upsert({
      where: { slug: a.slug },
      update: { title: a.title, description: a.description, emoji: a.emoji },
      create: a,
    });
  }
  console.log(`  ✓ ${achievements.length} achievements`);

  // Demo user
  await db.user.upsert({
    where: { email: "demo@estimateiq.app" },
    update: {},
    create: {
      email: "demo@estimateiq.app",
      name: "Demo User",
      passwordHash: hashPassword("demo1234"),
      onboardedAt: new Date(),
      xp: 340,
      level: 3,
      coins: 120,
      streak: 2,
      longestStreak: 4,
    },
  });

  // Admin user
  await db.user.upsert({
    where: { email: "admin@estimateiq.app" },
    update: { role: "admin" },
    create: {
      email: "admin@estimateiq.app",
      name: "Admin",
      role: "admin",
      passwordHash: hashPassword("admin1234"),
      onboardedAt: new Date(),
    },
  });
  console.log("  ✓ demo@estimateiq.app (demo1234) + admin@estimateiq.app (admin1234)");

  // Benchmark cohort for rank cold-start: synthetic users with a skill-rating
  // spread so a solo/offline user still gets a sensible percentile.
  const benchmarkCount = 40;
  for (let i = 0; i < benchmarkCount; i++) {
    // spread ratings ~35..92 with a gentle bell-ish shape
    const t = i / (benchmarkCount - 1);
    const rating = Math.round(35 + 57 * Math.pow(t, 0.9));
    const email = `benchmark_${i}@seed.estimateiq`;
    await db.user.upsert({
      where: { email },
      update: { skillRating: rating },
      create: {
        email,
        name: `Benchmark ${i}`,
        skillRating: rating,
        // mark as non-interactive benchmark accounts
        passwordHash: null,
      },
    });
  }
  console.log(`  ✓ ${benchmarkCount} benchmark cohort users (rank cold-start)`);

  console.log("✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";
import { BENCHMARK_EMAIL_DOMAIN } from "../lib/user-segment";
import { categories, questions, achievements } from "./seed-data";

const db = new PrismaClient();

const DAY_MS = 24 * 60 * 60 * 1000;

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
        sector: q.sector,
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
        expectedBuckets: q.expectedBuckets ? JSON.stringify(q.expectedBuckets) : null,
        dataPack: q.dataPack ? JSON.stringify(q.dataPack) : null,
        rootCause: q.rootCause ? JSON.stringify(q.rootCause) : null,
        // Re-asserted on update: the seed is the authority on what ships free,
        // so a re-seed puts the shop window back where the repo says it should
        // be rather than leaving an admin's experiment in place.
        //
        // Under the daily unlock the repo says NOTHING ships free, and no row in
        // `seed-data.ts` carries the flag any more. A permanently-open sample
        // would be a second answer to "what can this student do today", competing
        // with the day's grant — and because this line runs on every re-seed, a
        // single `freeTier: true` left in the data would silently undo an admin's
        // "Lock everything" the next time anyone re-seeded to pick up new content.
        // That is exactly what happened. Set the flag from the admin panel if you
        // want a permanent taster; do not put it back here.
        freeTier: q.freeTier ?? false,
        source: "seed",
      },
      create: {
        externalId: q.externalId,
        title: q.title,
        prompt: q.prompt,
        categoryId,
        sector: q.sector,
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
        expectedBuckets: q.expectedBuckets ? JSON.stringify(q.expectedBuckets) : null,
        dataPack: q.dataPack ? JSON.stringify(q.dataPack) : null,
        rootCause: q.rootCause ? JSON.stringify(q.rootCause) : null,
        freeTier: q.freeTier ?? false,
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

  // Demo user — the only seeded account with a filled-in profile, so a fresh
  // install can see a populated one and the target-level personalisation
  // without anybody typing anything.
  const demo = await db.user.upsert({
    where: { email: "demo@estimateiq.app" },
    // `update` is otherwise empty on purpose — a re-seed must not wipe the XP
    // and streak someone built up demoing. The pass is the exception: it is
    // seeded state rather than earned state, and it expires, so a re-seed has
    // to put it back or the demo account silently stops being Pro.
    update: { proUntil: new Date(Date.now() + 30 * DAY_MS) },
    create: {
      email: "demo@estimateiq.app",
      name: "Demo User",
      passwordHash: hashPassword("demo1234"),
      onboardedAt: new Date(),
      profileCompletedAt: new Date(),
      collegeId: "iim-bangalore",
      // Set in `create` only, like `collegeId` beside it — a re-seed must not
      // overwrite a batch someone corrected by hand. Every seeded login gets
      // one so no documented account meets `requireBatch` on first sign-in;
      // demo is PGP-2 because its profile bio already says second year.
      batch: "pgp2",
      // A live Pro pass, so a fresh clone has one account that sees the whole
      // library and one (admin, below) that hits the paywall — both states
      // reachable without granting anything first.
      proUntil: new Date(Date.now() + 30 * DAY_MS),
      xp: 340,
      level: 3,
      coins: 120,
      streak: 2,
      longestStreak: 4,
    },
  });

  await db.profile.upsert({
    where: { userId: demo.id },
    update: {},
    create: {
      userId: demo.id,
      city: "Bengaluru",
      bio: "Second-year PGP, targeting consulting. Weakest on market sizing.",
      profession: "student-mba",
      gradYear: new Date().getFullYear() + 1,
      experience: "0-2",
      targetLevels: JSON.stringify(["McKinsey", "BCG"]),
      targetCompanies: "McKinsey, BCG, Bain",
    },
  });

  // Admin user — deliberately left without a profile and without a Pro pass, so
  // the empty state, the dashboard nudge and the paywall are all reachable on a
  // fresh install without having to delete the demo user's data first.
  await db.user.upsert({
    where: { email: "admin@estimateiq.app" },
    // Cleared on every re-seed, the mirror of demo's pass being re-asserted.
    // The two accounts exist to show both sides of the paywall, and a pass
    // granted while testing would otherwise leave no account that can see it.
    update: { role: "admin", proUntil: null },
    create: {
      email: "admin@estimateiq.app",
      name: "Admin",
      role: "admin",
      passwordHash: hashPassword("admin1234"),
      onboardedAt: new Date(),
      batch: "pgp1",
    },
  });
  // Professor — the classroom host. Given a live Pro pass on purpose: hosting is
  // gated on the host's OWN tier (see `createRoom`), so a professor without one
  // could open a room on the single free war room and nothing else, which would
  // make the feature look broken on a fresh clone rather than gated. The pass is
  // re-asserted on every re-seed for the same reason demo's is.
  await db.user.upsert({
    where: { email: "prof@estimateiq.app" },
    update: { role: "professor", proUntil: new Date(Date.now() + 30 * DAY_MS) },
    create: {
      email: "prof@estimateiq.app",
      name: "Prof. Iyer",
      role: "professor",
      passwordHash: hashPassword("prof1234"),
      onboardedAt: new Date(),
      profileCompletedAt: new Date(),
      // Neither a professor nor an admin is really a PGP student; the field has
      // only the two values, so they carry one and it shows on no board they do
      // not rank on.
      batch: "pgp1",
      proUntil: new Date(Date.now() + 30 * DAY_MS),
    },
  });
  console.log(
    "  ✓ demo@estimateiq.app (demo1234) + admin@estimateiq.app (admin1234)" +
      " + prof@estimateiq.app (prof1234)",
  );

  // Benchmark cohort for rank cold-start: synthetic users with a skill-rating
  // spread so a solo/offline user still gets a sensible percentile.
  //
  // The email domain is how everything downstream tells these apart from real
  // accounts — the admin Users tab keeps them out of its headline counts — so it
  // comes from the shared constant rather than being spelled out here.
  const benchmarkCount = 40;
  for (let i = 0; i < benchmarkCount; i++) {
    // spread ratings ~35..92 with a gentle bell-ish shape
    const t = i / (benchmarkCount - 1);
    const rating = Math.round(35 + 57 * Math.pow(t, 0.9));
    const email = `benchmark_${i}${BENCHMARK_EMAIL_DOMAIN}`;
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

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, PlayCircle } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isLocked, tierFor, upgradeFor } from "@/lib/entitlements";
import { recommendQuestions } from "@/lib/questions";
import { simSummary } from "@/lib/simulations";
import { evaluationCategories } from "@/lib/config";
import { AppHeader } from "@/components/app/app-header";
import { StatCards } from "@/components/dashboard/stat-cards";
import { RankCard } from "@/components/dashboard/rank-card";
import { Achievements, type AchievementView } from "@/components/dashboard/achievements";
import { ProfileNudge } from "@/components/dashboard/profile-nudge";
import { ScoreTrendChart, SkillRadarChart } from "@/components/dashboard/charts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QuestionCard } from "@/components/library/question-card";

export const dynamic = "force-dynamic";

const SKILL_SHORT: Record<string, string> = {
  structuring: "Structure",
  logic: "Logic",
  segmentation: "Segment",
  assumptions: "Assumpt.",
  calculation: "Calc",
  diagnosis: "Diagnosis",
  communication: "Comm.",
  business: "Business",
  confidence: "Confidence",
};

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.isGuest) redirect("/signup");

  const [
    progress,
    submitted,
    inProgress,
    recommended,
    allAchievements,
    userAchievements,
    simStats,
  ] = await Promise.all([
      db.progress.findUnique({ where: { userId: user.id } }),
      db.attempt.findMany({
        where: { userId: user.id, status: "submitted" },
        include: { question: true, evaluation: true },
        orderBy: { submittedAt: "asc" },
      }),
      db.attempt.findMany({
        where: { userId: user.id, status: "in_progress" },
        include: { question: { include: { category: true } } },
        orderBy: { updatedAt: "desc" },
        take: 3,
      }),
      recommendQuestions(user.id, tierFor(user), 3),
      db.achievement.findMany(),
      db.userAchievement.findMany({ where: { userId: user.id } }),
      simSummary(user.id),
    ]);

  const stats = {
    totalSolved: progress?.totalSolved ?? 0,
    avgScore: Math.round(progress?.avgScore ?? 0),
    accuracy: progress?.accuracy ?? 0,
    consistency: progress?.consistency ?? 0,
    streak: user.streak,
  };

  const scoreTrend = submitted
    .filter((a) => a.evaluation)
    .map((a, i) => ({ label: `#${i + 1}`, score: a.evaluation!.overall }));

  const bySkill: Record<string, { avg: number; count: number }> = (() => {
    try {
      return JSON.parse(progress?.bySkill ?? "{}");
    } catch {
      return {};
    }
  })();
  const skillRadar = evaluationCategories
    .filter((c) => bySkill[c.key])
    .map((c) => ({ skill: SKILL_SHORT[c.key] ?? c.label, value: Math.round(bySkill[c.key].avg) }));

  const skillEntries = Object.entries(bySkill).sort((a, b) => a[1].avg - b[1].avg);
  const weak = skillEntries.slice(0, 2).map(([k]) => evaluationCategories.find((c) => c.key === k)?.label ?? k);
  const strong = skillEntries.slice(-2).reverse().map(([k]) => evaluationCategories.find((c) => c.key === k)?.label ?? k);

  const unlocked = new Set(userAchievements.map((u) => u.achievementId));
  const achievements: AchievementView[] = allAchievements.map((a) => ({
    slug: a.slug,
    title: a.title,
    description: a.description,
    emoji: a.emoji,
    unlocked: unlocked.has(a.id),
  }));

  const recent = [...submitted].reverse().slice(0, 5);

  return (
    <div className="min-h-screen">
      <AppHeader user={user} />
      <main className="container space-y-6 py-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back{user.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="mt-1 text-muted-foreground">Here&apos;s your interview-prep progress.</p>
        </div>

        {!user.profileCompletedAt && <ProfileNudge />}

        <StatCards stats={stats} />

        <div className="grid gap-6 lg:grid-cols-3">
          <RankCard rank={user.rank} percentile={user.percentile} xp={user.xp} level={user.level} />
          <Card className="p-5 lg:col-span-2">
            <h2 className="mb-3 font-semibold">Score trend</h2>
            <ScoreTrendChart data={scoreTrend} />
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="p-5">
            <h2 className="mb-3 font-semibold">Skill breakdown</h2>
            <SkillRadarChart data={skillRadar} />
          </Card>
          <Card className="p-5">
            <h2 className="mb-3 font-semibold">Focus areas</h2>
            {skillEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Solve a question to reveal strong & weak areas.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="mb-1.5 text-xs font-medium text-success">Strengths</div>
                  <div className="flex flex-wrap gap-1.5">
                    {strong.map((s) => (
                      <Badge key={s} variant="success">{s}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 text-xs font-medium text-warning">Work on</div>
                  <div className="flex flex-wrap gap-1.5">
                    {weak.map((s) => (
                      <Badge key={s} variant="warning">{s}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Card>
          <div className="lg:col-span-1">
            <Achievements achievements={achievements} />
          </div>
        </div>

        {/* Continue practice */}
        {inProgress.length > 0 && (
          <section>
            <h2 className="mb-3 font-semibold">Continue practice</h2>
            <div className="space-y-2">
              {inProgress.map((a) => (
                <Card key={a.id} className="flex items-center justify-between p-4">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{a.question.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.question.category.name} · {a.question.difficulty}
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/practice/${a.id}`}>
                      <PlayCircle className="h-4 w-4" /> Resume
                    </Link>
                  </Button>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Product simulations.
            A separate card rather than more numbers in StatCards: a simulation
            is scored on a different rubric, so averaging the two would produce
            a figure that means nothing. */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Product simulations</h2>
            <Link href="/library?type=simulation" className="text-sm text-primary hover:underline">
              Browse simulations <ArrowRight className="inline h-3 w-3" />
            </Link>
          </div>
          <Card className="p-5">
            {simStats.completed === 0 && simStats.inProgress === 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">You haven&apos;t run a simulation yet</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Read a dashboard, spend a budget finding the cause, then commit a quarter and
                    watch what happens to the business.
                  </p>
                </div>
                <Button asChild variant="outline">
                  <Link href="/library?type=simulation">
                    Try one <ArrowRight />
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-4">
                <div>
                  <div className="text-xs text-muted-foreground">Completed</div>
                  <div className="mt-0.5 text-2xl font-semibold tabular-nums">
                    {simStats.completed}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Causes found</div>
                  <div className="mt-0.5 text-2xl font-semibold tabular-nums">
                    {simStats.causesFound}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Best score</div>
                  <div className="mt-0.5 text-2xl font-semibold tabular-nums">
                    {simStats.bestOverall ?? "—"}
                  </div>
                </div>
                <div className="flex items-end">
                  {simStats.inProgress > 0 ? (
                    <Badge variant="warning">{simStats.inProgress} in progress</Badge>
                  ) : (
                    simStats.latest && (
                      <Link
                        href={`/simulate/${simStats.latest.runId}`}
                        className="text-sm text-primary hover:underline"
                      >
                        Last debrief <ArrowRight className="inline h-3 w-3" />
                      </Link>
                    )
                  )}
                </div>
              </div>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              Scored on their own rubric — simulations don&apos;t affect your interview readiness or
              rank.
            </p>
          </Card>
        </section>

        {/* Recommended */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Recommended for you</h2>
            <Link href="/library" className="text-sm text-primary hover:underline">
              Browse all <ArrowRight className="inline h-3 w-3" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recommended.map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                locked={isLocked(tierFor(user), q)}
                upgrade={upgradeFor(tierFor(user))}
              />
            ))}
          </div>
        </section>

        {/* Recently attempted */}
        {recent.length > 0 && (
          <section>
            <h2 className="mb-3 font-semibold">Recently attempted</h2>
            <Card className="divide-y">
              {recent.map((a) => (
                <Link
                  key={a.id}
                  href={`/practice/${a.id}`}
                  className="flex items-center justify-between p-4 hover:bg-accent/50"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{a.question.title}</div>
                    <div className="text-xs text-muted-foreground">{a.question.difficulty}</div>
                  </div>
                  {a.evaluation && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{a.evaluation.readiness}</Badge>
                      <span className="font-semibold tabular-nums">{a.evaluation.overall}</span>
                    </div>
                  )}
                </Link>
              ))}
            </Card>
          </section>
        )}
      </main>
    </div>
  );
}

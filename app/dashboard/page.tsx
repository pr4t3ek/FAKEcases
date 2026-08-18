import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isLocked, tierFor, upgradeFor } from "@/lib/entitlements";
import { recommendQuestions } from "@/lib/questions";
import { dailyGrantFor, resolveDaily } from "@/lib/daily-unlock";
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
import {
  GlobalLeaderboard,
  type BoardSide,
} from "@/components/dashboard/global-leaderboard";
import { globalBoard } from "@/lib/leaderboard";
import { requireBatch } from "@/lib/batch-gate";
import { requirePasswordChange } from "@/lib/password-gate";

export const dynamic = "force-dynamic";

/**
 * Shape the standings for the client component.
 *
 * `solved` becomes the row's small print, so a high total is visibly the sum of
 * many first attempts rather than an unexplained number.
 */
function toBoardSide(board: Awaited<ReturnType<typeof globalBoard>>): BoardSide {
  return {
    rows: board.top.map((s) => ({
      userId: s.userId,
      rank: s.rank,
      name: s.name,
      batch: s.batch,
      value: s.points,
      detail: `${s.solved} solved`,
    })),
    you: board.you
      ? { rank: board.you.rank, total: board.total, points: board.you.points }
      : null,
  };
}

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
  // Before anything is loaded: every board below this line shows a batch, and
  // the dashboard is where a student who has never been asked lands first.
  // A reset password opens nothing until it is replaced, so this runs ahead
  // of every other gate.
  requirePasswordChange(user);
  requireBatch(user);

  // Resolved before everything else because the recommendation query needs it.
  // The same grant the gates use, so a card that reads as open here is one
  // `startAttempt` will actually open.
  const grant = await dailyGrantFor(user);

  const [
    progress,
    submitted,
    allAchievements,
    userAchievements,
    simStats,
    dayBoard,
    weekBoard,
  ] = await Promise.all([
      db.progress.findUnique({ where: { userId: user.id } }),
      db.attempt.findMany({
        where: { userId: user.id, status: "submitted" },
        include: { question: true, evaluation: true },
        orderBy: { submittedAt: "asc" },
      }),
      db.achievement.findMany(),
      db.userAchievement.findMany({ where: { userId: user.id } }),
      simSummary(user.id),
      // Practice only. War rooms have their own board on /simulations — the two
      // are scored on different rubrics, so one combined total measured nothing.
      //
      // Two windows, not three. All-time rewards whoever started earliest and is
      // unreachable for anyone who joined last month; the cohort's board is the
      // one that resets, so the dashboard asks for the two that do.
      globalBoard(user.id, "day", "attempt"),
      globalBoard(user.id, "week", "attempt"),
    ]);

  // Today's pair, read through the same resolver the admin panel shows, so the
  // two surfaces cannot disagree about what today is.
  const todayPicks = await resolveDaily();
  const todayIds = todayPicks.map((p) => p.questionId).filter((id): id is string => id !== null);
  const todayQuestions = todayIds.length
    ? await db.question.findMany({
        where: { id: { in: todayIds } },
        include: { category: true },
      })
    : [];

  // Deliberately locked, and deliberately not today's pair: this section is
  // "what is coming", and repeating a question already shown above it reads as
  // a bug rather than as emphasis.
  const recommended = await recommendQuestions(user.id, tierFor(user), 3, grant, {
    includeLocked: true,
    exclude: todayIds,
  });

  const stats = {
    totalSolved: progress?.totalSolved ?? 0,
    avgScore: Math.round(progress?.avgScore ?? 0),
    accuracy: progress?.accuracy ?? 0,
    consistency: progress?.consistency ?? 0,
    streak: user.streak,
  };

  // Only scored attempts plot. One walked through by Teacher mode has an
  // evaluation and no overall, and a gap in the trend line is the honest shape:
  // there is no point to draw, not a point at zero.
  const scoreTrend = submitted
    .filter((a) => a.evaluation?.overall != null)
    .map((a, i) => ({ label: `#${i + 1}`, score: a.evaluation!.overall! }));

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

        {/* Today's questions.
            Directly under the stat boxes, because it is the only thing on this
            page the student can act on: the catalogue is locked and this pair is
            what the day's grant opens. Rendered with the same `QuestionCard` as
            the library rather than a bespoke tile, so "open" means the same
            thing on both. */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Today&apos;s questions</h2>
            <span className="text-xs text-muted-foreground">
              New pair every day
            </span>
          </div>
          {todayQuestions.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {todayQuestions.map((q) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  locked={isLocked(tierFor(user), q, grant)}
                  upgrade={upgradeFor(tierFor(user))}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nothing is unlocked today yet. Check back shortly.
            </p>
          )}
        </section>

        <GlobalLeaderboard
          day={toBoardSide(dayBoard)}
          week={toBoardSide(weekBoard)}
          currentUserId={user.id}
        />

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

        {/* Product simulations.
            A separate card rather than more numbers in StatCards: a simulation
            is scored on a different rubric, so averaging the two would produce
            a figure that means nothing. */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Product simulations</h2>
            <Link href="/simulations" className="text-sm text-primary hover:underline">
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
                  <Link href="/simulations">
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
                  {/* This badge used to be dead precisely when it mattered: it
                      announced "N in progress" with no way in, and the only
                      /simulate link was rendered when `inProgress === 0` — and
                      pointed at a finished run. The resumable one is the useful
                      destination, so it is the one that gets the link. */}
                  {simStats.resumable ? (
                    <Link
                      href={`/simulate/${simStats.resumable.runId}`}
                      title={simStats.resumable.title}
                    >
                      <Badge variant="warning" className="cursor-pointer hover:bg-warning/25">
                        Resume
                        {simStats.inProgress > 1 ? ` (${simStats.inProgress})` : ""}{" "}
                        <ArrowRight className="ml-1 inline h-3 w-3" />
                      </Badge>
                    </Link>
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

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Also in the library</h2>
            <Link href="/library" className="text-sm text-primary hover:underline">
              Browse all <ArrowRight className="inline h-3 w-3" />
            </Link>
          </div>
          {/* Renamed from "Recommended for you", which was a promise the
              catalogue can no longer keep: with everything but today's pair
              locked, most of what is recommended is something the student
              cannot open yet. Naming it honestly turns a row of dead ends into
              a row of things to look forward to. */}
          <p className="mb-3 text-sm text-muted-foreground">
            These open on another day — the rotation reaches every question.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recommended.map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                locked={isLocked(tierFor(user), q, grant)}
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
                  {a.evaluation &&
                    (a.evaluation.overall == null ? (
                      <Badge variant="muted">Not scored</Badge>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{a.evaluation.readiness}</Badge>
                        <span className="font-semibold tabular-nums">{a.evaluation.overall}</span>
                      </div>
                    ))}
                </Link>
              ))}
            </Card>
          </section>
        )}
      </main>
    </div>
  );
}

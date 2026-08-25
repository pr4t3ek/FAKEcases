import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { requirePasswordChange } from "@/lib/password-gate";
import { db } from "@/lib/db";
import { loadUserAdminStats } from "@/lib/admin-stats";
import { loadAdminAnalytics } from "@/lib/admin-analytics";
import { loadAdminScenarios } from "@/lib/scenario-store";
import { leverDriverIds } from "@/lib/sim/overlay";
import { MODE_PROMPTS } from "@/lib/llm/prompts";
import { aiModes } from "@/lib/config";
import { AppHeader } from "@/components/app/app-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  WalkthroughManager,
  type WalkthroughRow,
} from "@/components/admin/walkthrough-manager";
import { listWalkthroughs } from "@/lib/walkthrough";
import { parseWalkthrough } from "@/lib/walkthrough/types";
import { validateWalkthrough } from "@/lib/walkthrough/validate";
import { parseJson } from "@/lib/json";
import type { RootCause } from "@/lib/evaluation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QuestionManager } from "@/components/admin/question-manager";
import { CategoryManager } from "@/components/admin/category-manager";
import { ImportPanel } from "@/components/admin/import-panel";
import { FeedbackQueue } from "@/components/admin/feedback-queue";
import { UserDashboard } from "@/components/admin/user-dashboard";
import { AnalyticsDashboard } from "@/components/admin/analytics-dashboard";
import { ScenarioManager } from "@/components/admin/scenario-manager";
import {
  ContactEmailCard,
  DailyManager,
  LimitsCard,
} from "@/components/admin/daily-manager";
import { DAILY_SLOTS, dayKey, resolveDaily } from "@/lib/daily-unlock";
import { loadSettings, loadTextSettings } from "@/lib/settings";
import { LlmKeyManager } from "@/components/admin/llm-key-manager";
import { canUseStoredKeys, listKeyStatus } from "@/lib/llm/keys";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") redirect("/login");
  // Gated here, unlike `requireBatch`: an admin whose own password was reset is
  // exactly who must not carry on using a password anyone could guess, and the
  // way out (`/set-password`) needs no permission at all.
  requirePasswordChange(user);

  const [questions, categories, feedback, openCount, userStats, analytics, simScenarios, llmKeys] =
    await Promise.all([
      db.question.findMany({ include: { category: true }, orderBy: { createdAt: "desc" } }),
      db.category.findMany({
        orderBy: { order: "asc" },
        include: { _count: { select: { questions: true } } },
      }),
      db.questionFeedback.findMany({
        include: { question: { select: { title: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      db.questionFeedback.count({ where: { status: "Open" } }),
      loadUserAdminStats(),
      loadAdminAnalytics(),
      loadAdminScenarios(),
      listKeyStatus(),
    ]);

  // Seven days from today, each resolved the way a student's gate resolves it —
  // pin if there is one, otherwise the pick derived from the date. Nothing here
  // is written; the whole week is computed.
  const week = Array.from({ length: 7 }, (_, i) =>
    dayKey(new Date(Date.now() + i * 86_400_000)),
  );
  const professorRequests = userStats.users.filter((u) => u.professorRequested && u.role === "user").length;

  const [weekPicks, limits, text] = await Promise.all([
    Promise.all(week.map(async (day) => ({ day, picks: await resolveDaily(day) }))),
    loadSettings(),
    loadTextSettings(),
  ]);

  const titleOf = new Map(questions.map((q) => [q.id, q.title]));
  const dailyRows = weekPicks.flatMap(({ day, picks }) =>
    picks.map((p) => ({
      day,
      slot: p.slot as string,
      questionId: p.questionId,
      questionTitle: p.questionId ? (titleOf.get(p.questionId) ?? "(missing)") : null,
      pinned: p.pinned,
    })),
  );

  const pickable = (type: string) =>
    questions
      .filter((q) => q.type === type)
      .map((q) => ({ id: q.id, title: q.title, type: q.type, difficulty: q.difficulty }));

  const lockedCount = questions.filter((q) => !q.freeTier).length;

  // Worked examples, each re-checked as it is listed. The validator runs here
  // rather than at write time because the QUESTION can be edited after a
  // walkthrough was approved against it — its ideal range, or the branches a
  // case is scored on — so "does this still hold?" is a question with a fresh
  // answer on every visit.
  const walkthroughs = await listWalkthroughs();
  const demoExternalId = text.walkthroughDemoQuestion;
  const walkthroughRows: WalkthroughRow[] = walkthroughs.map((w) => {
    const content = parseWalkthrough(w.stepsJson);
    const check = validateWalkthrough(content, {
      idealLow: w.question.idealLow,
      idealHigh: w.question.idealHigh,
      expectedBuckets: parseJson<string[]>(w.question.expectedBuckets) ?? [],
      rootCause: parseJson<RootCause>(w.question.rootCause),
    });
    return {
      questionId: w.questionId,
      externalId: w.question.externalId,
      title: w.question.title,
      status: w.status,
      source: w.source,
      total: check.total,
      idealLow: w.question.idealLow,
      idealHigh: w.question.idealHigh,
      unit: w.question.unit,
      problem: check.ok ? null : (check.issues[0]?.message ?? "This does not check out."),
      stepCount: content?.steps.length ?? 0,
      stepsJson: w.stepsJson,
    };
  });

  return (
    <div className="min-h-screen">
      <AppHeader user={user} />
      <main className="container py-8">
        <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
        <p className="mt-1 text-muted-foreground">
          Manage questions, categories and imports; review feedback and how the app is being used.
        </p>

        {/* Analytics leads and Users follows: the first question is how the
            cohort is doing, and the roster is one click away when the answer
            turns out to be about somebody in particular. */}
        <Tabs defaultValue="analytics" className="mt-6">
          <TabsList className="flex-wrap">
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="users">
              Users
              {/* Badged like the feedback queue beside it, and for the same
                  reason: a professor request is a question waiting on the admin,
                  and a queue nobody is told about is a queue nobody works. */}
              {professorRequests > 0 && (
                <Badge variant="warning" className="ml-1">{professorRequests}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="questions">Questions</TabsTrigger>
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="import">Import</TabsTrigger>
            <TabsTrigger value="simulations">
              Simulations
              {simScenarios.some((s) => s.rejected) && (
                <Badge variant="destructive" className="ml-1">!</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="feedback">
              Feedback
              {openCount > 0 && <Badge variant="warning" className="ml-1">{openCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="walkthroughs">
              Examples
              {walkthroughRows.some((r) => r.problem !== null) && (
                <Badge variant="destructive" className="ml-1">!</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="prompts">Prompts</TabsTrigger>
          </TabsList>

          <TabsContent value="walkthroughs" className="mt-4">
            <WalkthroughManager rows={walkthroughRows} demoExternalId={demoExternalId} />
          </TabsContent>

          <TabsContent value="analytics" className="mt-4">
            {/* The two charts moved here from Users, so cohort-level lives in
                one place — and they are passed rather than re-queried, since
                `loadUserAdminStats` already computed both. */}
            <AnalyticsDashboard
              analytics={analytics}
              signups={userStats.signups}
              ranks={userStats.ranks}
            />
          </TabsContent>

          <TabsContent value="users" className="mt-4">
            <UserDashboard stats={userStats} />
          </TabsContent>

          <TabsContent value="questions" className="mt-4">
            <QuestionManager
              questions={questions.map((q) => ({
                id: q.id,
                title: q.title,
                prompt: q.prompt,
                categoryId: q.categoryId,
                sector: q.sector,
                difficulty: q.difficulty,
                interviewLevel: q.interviewLevel,
                type: q.type,
                idealLow: q.idealLow,
                idealHigh: q.idealHigh,
                unit: q.unit,
                framework: q.framework,
                expectedBuckets: q.expectedBuckets,
                dataPack: q.dataPack,
                rootCause: q.rootCause,
                betterApproach: q.betterApproach,
                sampleSolution: q.sampleSolution,
                tags: q.tags,
                freeTier: q.freeTier,
                source: q.source,
                category: { name: q.category.name },
              }))}
              categories={categories.map((c) => ({ id: c.id, name: c.name }))}
            />
          </TabsContent>

          <TabsContent value="daily" className="mt-4 space-y-4">
            <DailyManager
              rows={dailyRows}
              guesstimates={pickable("guesstimate")}
              warRooms={pickable(DAILY_SLOTS[1])}
              lockedCount={lockedCount}
              totalCount={questions.length}
            />
            <LimitsCard limits={limits} />
            <ContactEmailCard email={text.adminContactEmail} />
            <LlmKeyManager keys={llmKeys} authSecretReady={canUseStoredKeys()} />
          </TabsContent>

          <TabsContent value="categories" className="mt-4">
            <CategoryManager
              categories={categories.map((c) => ({
                id: c.id,
                slug: c.slug,
                name: c.name,
                _count: c._count,
              }))}
            />
          </TabsContent>

          <TabsContent value="import" className="mt-4">
            <ImportPanel />
          </TabsContent>

          <TabsContent value="simulations" className="mt-4">
            <ScenarioManager
              scenarios={simScenarios.map((s) => ({
                slug: s.base.slug,
                title: s.base.title,
                company: s.base.company,
                difficulty: s.base.difficulty,
                northStar: s.base.northStar,
                // The graph actually in effect, which is the authored one when a
                // stored override was refused — so the editor opens on what
                // students are seeing rather than on a version nobody is served.
                currentJson: JSON.stringify(s.scenario.drivers, null, 2),
                baseJson: JSON.stringify(s.base.drivers, null, 2),
                overridden: s.overridden,
                rejected: s.rejected,
                note: s.note,
                updatedAt: s.updatedAt?.toISOString() ?? null,
                updatedByName: s.updatedByName,
                leverIds: leverDriverIds(s.scenario),
              }))}
            />
          </TabsContent>

          <TabsContent value="feedback" className="mt-4">
            <FeedbackQueue
              feedback={feedback.map((f) => ({
                id: f.id,
                type: f.type,
                message: f.message,
                status: f.status,
                createdAt: f.createdAt.toISOString(),
                question: { title: f.question.title },
              }))}
            />
          </TabsContent>

          <TabsContent value="prompts" className="mt-4">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                System prompts that shape interviewer behaviour (India-only). Editable in{" "}
                <code className="rounded bg-muted px-1">lib/llm/prompts.ts</code>.
              </p>
              {aiModes.map((m) => (
                <Card key={m.key} className="p-4">
                  <div className="mb-2 font-semibold">{m.label}</div>
                  <pre className="scrollbar-thin overflow-x-auto whitespace-pre-wrap text-xs text-muted-foreground">
                    {MODE_PROMPTS[m.key]}
                  </pre>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

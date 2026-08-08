import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadUserAdminStats } from "@/lib/admin-stats";
import { loadAdminScenarios } from "@/lib/scenario-store";
import { leverDriverIds } from "@/lib/sim/overlay";
import { MODE_PROMPTS } from "@/lib/llm/prompts";
import { aiModes } from "@/lib/config";
import { AppHeader } from "@/components/app/app-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QuestionManager } from "@/components/admin/question-manager";
import { CategoryManager } from "@/components/admin/category-manager";
import { ImportPanel } from "@/components/admin/import-panel";
import { FeedbackQueue } from "@/components/admin/feedback-queue";
import { UserDashboard } from "@/components/admin/user-dashboard";
import { ScenarioManager } from "@/components/admin/scenario-manager";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") redirect("/login");

  const [questions, categories, feedback, openCount, userStats, simScenarios] = await Promise.all([
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
    loadAdminScenarios(),
  ]);

  return (
    <div className="min-h-screen">
      <AppHeader user={user} />
      <main className="container py-8">
        <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
        <p className="mt-1 text-muted-foreground">
          Manage questions, categories and imports; review feedback and how the app is being used.
        </p>

        {/* Users leads: it's the overview, and the content tabs are a click away. */}
        <Tabs defaultValue="users" className="mt-6">
          <TabsList className="flex-wrap">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="questions">Questions</TabsTrigger>
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
            <TabsTrigger value="prompts">Prompts</TabsTrigger>
          </TabsList>

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

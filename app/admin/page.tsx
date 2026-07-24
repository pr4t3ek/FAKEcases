import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
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

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") redirect("/login");

  const [questions, categories, feedback, openCount] = await Promise.all([
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
  ]);

  return (
    <div className="min-h-screen">
      <AppHeader user={user} />
      <main className="container py-8">
        <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
        <p className="mt-1 text-muted-foreground">Manage questions, categories, imports and feedback.</p>

        <Tabs defaultValue="questions" className="mt-6">
          <TabsList className="flex-wrap">
            <TabsTrigger value="questions">Questions</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="import">Import</TabsTrigger>
            <TabsTrigger value="feedback">
              Feedback
              {openCount > 0 && <Badge variant="warning" className="ml-1">{openCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="prompts">Prompts</TabsTrigger>
          </TabsList>

          <TabsContent value="questions" className="mt-4">
            <QuestionManager
              questions={questions.map((q) => ({
                id: q.id,
                title: q.title,
                prompt: q.prompt,
                categoryId: q.categoryId,
                difficulty: q.difficulty,
                interviewLevel: q.interviewLevel,
                idealLow: q.idealLow,
                idealHigh: q.idealHigh,
                unit: q.unit,
                betterApproach: q.betterApproach,
                sampleSolution: q.sampleSolution,
                tags: q.tags,
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

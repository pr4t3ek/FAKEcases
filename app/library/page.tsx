import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { listCategories, listQuestions } from "@/lib/questions";
import { AppHeader } from "@/components/app/app-header";
import { FilterBar } from "@/components/library/filter-bar";
import { QuestionCard } from "@/components/library/question-card";

export const dynamic = "force-dynamic";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const [user, categories, questions] = await Promise.all([
    getSessionUser(),
    listCategories(),
    listQuestions({
      categorySlug: sp.category,
      difficulty: sp.difficulty,
      interviewLevel: sp.level,
      search: sp.q,
    }),
  ]);

  return (
    <div className="min-h-screen">
      <AppHeader user={user} />
      <main className="container py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Question Library</h1>
          <p className="mt-1 text-muted-foreground">
            {questions.length} India-only guesstimate{questions.length === 1 ? "" : "s"}. Pick any —
            everything is free to practise.
          </p>
        </div>

        {sp.wall && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
            <Sparkles className="h-5 w-5 shrink-0 text-primary" />
            <span>
              You&apos;ve used your free guest attempts.{" "}
              <Link href="/signup" className="font-medium text-primary underline underline-offset-4">
                Create a free account
              </Link>{" "}
              to keep practising and save your progress.
            </span>
          </div>
        )}

        <FilterBar categories={categories} />

        {questions.length === 0 ? (
          <div className="mt-16 text-center text-muted-foreground">
            No questions match your filters. Try clearing them.
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {questions.map((q) => (
              <QuestionCard key={q.id} question={q} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

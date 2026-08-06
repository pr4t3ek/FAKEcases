import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { isLocked, tierFor, upgradeFor, WALL_LOCKED, WALL_PARAM } from "@/lib/entitlements";
import { listCategories, listQuestions } from "@/lib/questions";
import { answerModeFor, isSimulation } from "@/lib/types";
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
      type: sp.type,
    }),
  ]);

  // Say what's actually in the list. The old copy called every question a
  // guesstimate, which told anyone hunting for a case that the library held
  // none — while the cases sat at the bottom of the page. A simulation has to
  // be counted separately for the same reason, and `isSimulation` is checked
  // first because `answerModeFor` would report one as qualitative.
  const simCount = questions.filter((q) => isSimulation(q.type)).length;
  const caseCount = questions.filter(
    (q) => !isSimulation(q.type) && answerModeFor(q.type) === "qualitative",
  ).length;
  const guesstimateCount = questions.length - caseCount - simCount;
  const summary = [
    guesstimateCount > 0 && `${guesstimateCount} guesstimate${guesstimateCount === 1 ? "" : "s"}`,
    caseCount > 0 && `${caseCount} case${caseCount === 1 ? "" : "s"}`,
    simCount > 0 && `${simCount} decision simulation${simCount === 1 ? "" : "s"}`,
  ]
    .filter(Boolean)
    .join(", ")
    .replace(/, ([^,]*)$/, " and $1");

  // The same function the server gate calls, so a card can never offer
  // something `startAttempt` would refuse. `getSessionUser` returns null for a
  // visitor who hasn't clicked anything yet — `tierFor` reads that as a guest,
  // which is what they are about to become.
  const tier = tierFor(user);
  const upgrade = upgradeFor(tier);
  const openCount = questions.filter((q) => !isLocked(tier, q)).length;
  const lockedCount = questions.length - openCount;

  return (
    <div className="min-h-screen">
      <AppHeader user={user} />
      <main className="container py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Question Library</h1>
          <p className="mt-1 text-muted-foreground">
            {summary || "No questions"}, India-only.{" "}
            {lockedCount > 0
              ? `${openCount} open to you, ${lockedCount} unlocked by a free account.`
              : "Pick any — everything is free to practise."}
          </p>
        </div>

        {/* Raised when a gate turned someone away. Landing back here rather than
            on a bare signup form is the point: it names what happened, and the
            free items are still on the page to be played. */}
        {sp[WALL_PARAM] === WALL_LOCKED && upgrade && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
            <Sparkles className="h-5 w-5 shrink-0 text-primary" />
            <span>
              That one needs an account. {upgrade.reason}{" "}
              <Link
                href={upgrade.href}
                className="font-medium text-primary underline underline-offset-4"
              >
                {upgrade.cta}
              </Link>
              .
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
              <QuestionCard
                key={q.id}
                question={q}
                locked={isLocked(tier, q)}
                upgrade={upgrade}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

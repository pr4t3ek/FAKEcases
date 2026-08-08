import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { isLocked, tierFor, upgradeFor, WALL_LOCKED, WALL_PARAM } from "@/lib/entitlements";
import { prefillLevel, targetLevelsFor } from "@/lib/profile";
import { listCategories, listQuestions, listSectors } from "@/lib/questions";
import { answerModeFor, type InterviewLevel } from "@/lib/types";
import { AppHeader } from "@/components/app/app-header";
import { FilterBar } from "@/components/library/filter-bar";
import { TargetLevelsHint } from "@/components/library/target-levels-hint";
import { QuestionCard } from "@/components/library/question-card";

export const dynamic = "force-dynamic";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const [user, categories, sectors, questions] = await Promise.all([
    getSessionUser(),
    listCategories("practice"),
    listSectors("practice"),
    listQuestions({
      surface: "practice",
      categorySlug: sp.category,
      sector: sp.sector,
      difficulty: sp.difficulty,
      interviewLevel: sp.level,
      search: sp.q,
      type: sp.type,
    }),
  ]);

  // Say what's actually in the list. The old copy called every question a
  // guesstimate, which told anyone hunting for a case that the library held
  // none — while the cases sat at the bottom of the page. War rooms are no
  // longer counted here at all: they have their own catalogue, and counting
  // them in a total you cannot reach from this page would be worse than not
  // mentioning them.
  const caseCount = questions.filter((q) => answerModeFor(q.type) === "qualitative").length;
  const guesstimateCount = questions.length - caseCount;
  const summary = [
    guesstimateCount > 0 && `${guesstimateCount} guesstimate${guesstimateCount === 1 ? "" : "s"}`,
    caseCount > 0 && `${caseCount} case${caseCount === 1 ? "" : "s"}`,
  ]
    .filter(Boolean)
    .join(" and ");

  // The same function the server gate calls, so a card can never offer
  // something `startAttempt` would refuse. `getSessionUser` returns null for a
  // visitor who hasn't clicked anything yet — `tierFor` reads that as a guest,
  // which is what they are about to become.
  const tier = tierFor(user);
  const upgrade = upgradeFor(tier);

  // Goals shape the first view rather than only sitting on the profile. The
  // decision of whether to apply one is `prefillLevel`, which refuses to
  // override a URL the visitor actually chose.
  const targets = await targetLevelsFor(user?.isGuest ? null : user?.id);
  const appliedLevel =
    sp.level && targets.includes(sp.level as InterviewLevel)
      ? (sp.level as InterviewLevel)
      : null;
  const openCount = questions.filter((q) => !isLocked(tier, q)).length;
  const lockedCount = questions.length - openCount;

  return (
    <div className="min-h-screen">
      <AppHeader user={user} />
      <main className="container py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Question Library</h1>
          <p className="mt-1 text-muted-foreground">
            {/* War rooms are not mentioned here at all. They are a nav item, and
                a second pointer on the page that does not hold them invited a
                detour out of the catalogue someone had just opened. */}
            {summary || "No questions"}, India-only.{" "}
            {/* Tier-aware, because the same sentence has to work for a visitor
                with no account and for a signed-in one who needs a pass. The
                phrase comes from the tier table, so neither is told to get
                something they already have. */}
            {lockedCount > 0 && upgrade
              ? `${openCount} open to you, ${lockedCount} more ${upgrade.unlocks}.`
              : tier === "pro"
                ? "Pick any — your Pro pass opens all of them."
                : "Pick any — everything is open to you."}
          </p>
        </div>

        {/* Raised when a gate turned someone away. Landing back here rather than
            on a bare signup form is the point: it names what happened, and the
            free items are still on the page to be played. */}
        {sp[WALL_PARAM] === WALL_LOCKED && upgrade && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
            <Sparkles className="h-5 w-5 shrink-0 text-primary" />
            <span>
              {/* Neutral lead — what's needed differs by tier, and the reason
                  below already says which. */}
              That one&apos;s locked. {upgrade.reason}{" "}
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

        <FilterBar categories={categories} sectors={sectors} />
        <TargetLevelsHint
          targets={targets}
          applied={appliedLevel}
          prefill={prefillLevel(targets, sp)}
        />

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

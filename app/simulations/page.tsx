import Link from "next/link";
import { Siren, Sparkles } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { requireBatch } from "@/lib/batch-gate";
import { isLocked, tierFor, upgradeFor, WALL_LOCKED, WALL_PARAM } from "@/lib/entitlements";
import { dailyGrantFor } from "@/lib/daily-unlock";
import { listCategories, listQuestions, listSectors } from "@/lib/questions";
import { simStateByQuestion } from "@/lib/simulations";
import { canHostRooms } from "@/lib/types";
import type { SimQuestionState } from "@/lib/sim/replay";
import { AppHeader } from "@/components/app/app-header";
import { FilterBar } from "@/components/library/filter-bar";
import { QuestionCard } from "@/components/library/question-card";
import {
  GlobalLeaderboard,
  type BoardSide,
} from "@/components/dashboard/global-leaderboard";
import { globalBoard } from "@/lib/leaderboard";

/**
 * Shape the standings for the client component.
 *
 * A copy of the dashboard's helper rather than a shared one: the small print
 * differs — "3 played" here against "12 solved" there — and the two boards are
 * deliberately not the same board.
 */
function toBoardSide(board: Awaited<ReturnType<typeof globalBoard>>): BoardSide {
  return {
    rows: board.top.map((s) => ({
      userId: s.userId,
      rank: s.rank,
      name: s.name,
      college: s.college,
      batch: s.batch,
      value: s.points,
      detail: `${s.solved} played`,
    })),
    you: board.you
      ? { rank: board.you.rank, total: board.total, points: board.you.points }
      : null,
  };
}

/**
 * The war room catalogue.
 *
 * Its own route rather than `/library?type=simulation`, which is what it used to
 * be. The two formats are not variants of one another: a guesstimate is answered
 * in twenty minutes and a war room is *played* across four phases against a
 * budget, and a single grid holding both said they were interchangeable. It also
 * meant the running order had to hoist simulations above everything else to stop
 * them being buried, which is a presentation hack standing in for a page.
 *
 * The catalogue reads and the cards are shared with the library — this is a
 * different surface over the same `Question` table, not a second implementation
 * of one. `QuestionSurface` in lib/types.ts is what keeps them apart.
 */
export const dynamic = "force-dynamic";

export default async function SimulationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const [user, categories, sectors, questions] = await Promise.all([
    getSessionUser(),
    listCategories("simulation"),
    listSectors("simulation"),
    listQuestions({
      surface: "simulation",
      categorySlug: sp.category,
      sector: sp.sector,
      difficulty: sp.difficulty,
      interviewLevel: sp.level,
      search: sp.q,
    }),
  ]);

  // As on /library: asked before the catalogue, and never of a guest.
  if (user) requireBatch(user);

  // The war-room board, kept apart from the practice one: a simulation's score
  // and a guesstimate's come off different rubrics, and the sum of the two was
  // a number that measured nothing. Guests have no standings to show.
  const [weekBoard, allTimeBoard] = user
    ? await Promise.all([
        globalBoard(user.id, "week", "simulation"),
        globalBoard(user.id, "all", "simulation"),
      ])
    : [null, null];

  const tier = tierFor(user);
  // The same grant the server gate uses, so a card that reads as open is one
  // `startAttempt` will actually open — the disagreement `lib/entitlements.ts`
  // exists to prevent.
  const grant = await dailyGrantFor(user);
  const upgrade = upgradeFor(tier);
  // Professors and admins get a "host this in class" control on each unlocked
  // card. Read here rather than inside the card so the card stays a pure view.
  const canHost = !!user && canHostRooms(user.role);
  const openCount = questions.filter((q) => !isLocked(tier, q, grant)).length;
  const lockedCount = questions.length - openCount;

  // One query for the grid — see `simStateByQuestion`. Skipped for a visitor with
  // no session: there is nothing to look up, and `getOrCreateGuest` only mints a
  // row once they actually click something.
  const simState: Record<string, SimQuestionState> = user
    ? await simStateByQuestion(user.id)
    : {};
  const inProgress = questions.filter((q) => simState[q.id]?.state === "in_progress").length;

  return (
    <div className="min-h-screen">
      <AppHeader user={user} />
      <main className="container py-8">
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Siren className="h-6 w-6 text-primary" /> War rooms
          </h1>
          <p className="mt-1 max-w-3xl text-muted-foreground">
            Read the dashboard, commit to a hypothesis before spending anything, buy the data
            that would test it, then name the cause and back it with a quarter of capacity. You
            are judged on the metrics that moved, not on a mark.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {questions.length} scenario{questions.length === 1 ? "" : "s"}, easiest first.{" "}
            {lockedCount > 0 && upgrade
              ? `${openCount} open to you, ${lockedCount} more ${upgrade.unlocks}.`
              : tier === "pro"
                ? "Your Pro pass opens all of them."
                : "All of them are open to you."}
          </p>
        </div>

        {/* Raised when a gate turned someone away — and it lands here rather than
            on the library, so the scenario they were refused is still on the
            page beside the free one they can play. */}
        {sp[WALL_PARAM] === WALL_LOCKED && upgrade && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
            <Sparkles className="h-5 w-5 shrink-0 text-primary" />
            <span>
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

        {inProgress > 0 && (
          <div className="mb-6 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
            You have {inProgress} war room{inProgress === 1 ? "" : "s"} still open. Analyst-days
            already spent stay spent — pick up where you left off rather than starting again.
          </div>
        )}

        {user && weekBoard && allTimeBoard && (
          <div className="mb-6">
            <GlobalLeaderboard
              week={toBoardSide(weekBoard)}
              all={toBoardSide(allTimeBoard)}
              currentUserId={user.id}
              title="War room leaderboard"
              unit="war room"
              emptyThisWeek="No war rooms committed yet this week. Finish one to open the board."
              emptyAllTime="No war rooms committed yet. Your first run of any scenario puts you here."
            />
          </div>
        )}

        <FilterBar categories={categories} sectors={sectors} surface="simulation" />

        {questions.length === 0 ? (
          <div className="mt-16 text-center text-muted-foreground">
            No war rooms match your filters. Try clearing them.
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {questions.map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                locked={isLocked(tier, q, grant)}
                upgrade={upgrade}
                simState={simState[q.id] ?? null}
                canHost={canHost}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

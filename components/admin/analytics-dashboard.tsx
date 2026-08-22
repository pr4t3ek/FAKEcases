import {
  Beaker,
  CalendarClock,
  CircleSlash,
  Gamepad2,
  GraduationCap,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import type { AdminAnalytics } from "@/lib/admin-analytics";
import { EXHAUSTION_THRESHOLD, QUIET_AFTER_DAYS } from "@/lib/admin-analytics";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { RankDistributionChart, SignupsChart } from "./user-charts";
import {
  ActiveWeeksChart,
  CoverageChart,
  FormatMixChart,
  QuietChart,
} from "./analytics-charts";

/**
 * The cohort at a glance.
 *
 * A server component: everything on it is read-only, so unlike the Users tab
 * next door there is nothing to hydrate but the charts themselves.
 *
 * Every panel says what it counts. These numbers get quoted in meetings, and a
 * figure whose definition is a guess is worse than no figure — which is why the
 * return rates carry their denominators and the coverage card carries the
 * caveat that only Pro reaches the whole library.
 */

const percent = (part: number, whole: number) =>
  whole === 0 ? "—" : `${Math.round((part / whole) * 100)}%`;

function Tile({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  sub?: string;
  tone?: "warning";
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs">{label}</span>
      </div>
      <div
        className={cn(
          "mt-1 text-2xl font-bold tabular-nums",
          tone === "warning" && "text-warning",
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </Card>
  );
}

/**
 * What the quiet histogram means, in the memo's own terms.
 *
 * `docs/RETENTION.md` calls this the metric that could invalidate the rest of
 * its plan, and the whole value is in the reading rather than the bars — so the
 * panel does the reading rather than leaving an admin to remember the rule.
 */
function quietReading(modal: string | null, librarySize: number): string {
  if (!modal) {
    return `Nobody has been silent for ${QUIET_AFTER_DAYS} days yet, so there is nothing to read here.`;
  }
  if (modal === "1" || modal === "2–3") {
    return (
      `Most accounts that go quiet stop after ${modal} attempts, nowhere near the ` +
      `${librarySize} questions available. That reads as an activation problem rather than a ` +
      `content one — people are not reaching a third question, so the size of the library is ` +
      `not what is losing them.`
    );
  }
  if (modal === "11–20" || modal === "21+") {
    return (
      `Most accounts that go quiet stop after ${modal} attempts, which is a real share of the ` +
      `${librarySize} available. That reads as content exhaustion — the library is being worked ` +
      `through faster than it grows.`
    );
  }
  return (
    `Most accounts that go quiet stop after ${modal} attempts, out of ${librarySize} available. ` +
    `Between the two readings: far enough in to have formed a habit, nowhere near the end of the ` +
    `catalogue.`
  );
}

export function AnalyticsDashboard({
  analytics,
  signups,
  ranks,
}: {
  analytics: AdminAnalytics;
  /** Already computed by `loadUserAdminStats` — not queried twice. */
  signups: { day: string; count: number }[];
  ranks: { rank: string; count: number }[];
}) {
  const { cohort, practice, retention } = analytics;
  const started = cohort.registered - cohort.neverStarted;

  return (
    <div className="space-y-6">
      {/* ── Who is here ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Tile icon={Users} label="Registered" value={cohort.registered} />
        <Tile icon={UserRound} label="Guests" value={cohort.guests} sub="never signed up" />
        <Tile
          icon={CalendarClock}
          label="Active (7d)"
          value={cohort.activeWeek}
          sub={`${cohort.activeMonth} in 30d`}
        />
        <Tile
          icon={CircleSlash}
          label="Never started"
          value={cohort.neverStarted}
          sub={`of ${cohort.registered} registered`}
          tone={cohort.neverStarted > 0 ? "warning" : undefined}
        />
        <Tile icon={Sparkles} label="Pro" value={cohort.pro} sub="live passes" />
        <Tile icon={GraduationCap} label="Professors" value={cohort.professors} />
        <Tile
          icon={Gamepad2}
          label="Arena"
          value={cohort.arenaGranted}
          sub={`${cohort.arenaMatches} match${cohort.arenaMatches === 1 ? "" : "es"} played`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Batches:</span>
        {cohort.batches.map((b) => (
          <Badge key={b.label} variant={b.count > 0 ? "secondary" : "muted"}>
            {b.label} · {b.count}
          </Badge>
        ))}
        <span className="ml-auto">
          Counts are queries, not samples — benchmark accounts and deleted-account tombstones are
          excluded. Activity-based panels look back {analytics.windowDays} days.
        </span>
      </div>

      {/* ── What is being practised ─────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-semibold">What is being practised</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Opened against finished, by format. A war room finishes when it reaches the debrief.
            Arena matches are not here — a match is a game rather than an exercise, and it is
            scored on its own rubric.
          </p>
          <FormatMixChart data={practice.formats} />
          <table className="mt-3 w-full text-xs">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="pb-1 font-medium">Format</th>
                <th className="pb-1 text-right font-medium">Opened</th>
                <th className="pb-1 text-right font-medium">Finished</th>
                <th className="pb-1 text-right font-medium">Completion</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {practice.formats.map((f) => (
                <tr key={f.type} className="border-t">
                  <td className="py-1">{f.label}</td>
                  <td className="py-1 text-right">{f.started}</td>
                  <td className="py-1 text-right">{f.submitted}</td>
                  <td
                    className={cn(
                      "py-1 text-right",
                      f.started > 0 && f.completion < 50 && "text-warning",
                    )}
                  >
                    {f.started === 0 ? "—" : `${f.completion}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold">Busiest questions</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Most opened first. A low completion rate here is the more useful column: it names the
            question people start and walk away from.
          </p>
          {practice.topQuestions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nothing has been opened yet.
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="pb-1 font-medium">Question</th>
                  <th className="pb-1 text-right font-medium">Opened</th>
                  <th className="pb-1 text-right font-medium">Completion</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {practice.topQuestions.map((q) => {
                  const completion =
                    q.started === 0 ? null : Math.round((q.submitted / q.started) * 100);
                  return (
                    <tr key={q.id} className="border-t">
                      <td className="max-w-[18rem] truncate py-1 pr-2" title={q.title}>
                        {q.title}
                      </td>
                      <td className="py-1 text-right">{q.started}</td>
                      <td
                        className={cn(
                          "py-1 text-right",
                          completion !== null && completion < 50 && "text-warning",
                        )}
                      >
                        {completion === null ? "—" : `${completion}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {/* ── Does anybody come back ──────────────────────────────────────── */}
      <Card className="p-5">
        <h2 className="font-semibold">Do they come back?</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Of the accounts old enough for each window to have closed, the share that did anything at
          all on a <em>later</em> day — an attempt, a war room or an Arena match. The denominators
          are shown because a rate off five accounts is not a rate.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {retention.returns.map((r) => (
            <div key={r.window} className="rounded-lg border p-3 text-center">
              <div className="text-xs text-muted-foreground">D{r.window}</div>
              <div className="text-2xl font-bold tabular-nums">
                {percent(r.returned, r.eligible)}
              </div>
              <div className="text-[11px] text-muted-foreground tabular-nums">
                {r.returned} of {r.eligible}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-semibold">How often, when they do</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            People active each week, and how many separate days each of them turned up. Days rather
            than sessions: nothing here records a session, and calling a day one would be inventing
            precision. Flat at 1.0 is a cram; above 2 is a habit.
          </p>
          <ActiveWeeksChart data={retention.weeks} />
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold">Where they stop</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Lifetime attempts of accounts silent for {QUIET_AFTER_DAYS} days or more
            ({retention.quiet.quietPeople} of them). Accounts that never started at all are counted
            separately, above.
          </p>
          <QuietChart data={retention.quiet.buckets} modal={retention.quiet.modal} />
          <p className="mt-3 rounded-md border-l-2 border-primary bg-primary/5 px-2.5 py-2 text-xs">
            {quietReading(retention.quiet.modal, retention.librarySize)}
          </p>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="font-semibold">How much of the library they have seen</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Distinct questions attempted against the {retention.librarySize} practisable ones.
          Past {Math.round(EXHAUSTION_THRESHOLD * 100)}% counts as exhausted. Pro is shown apart
          because only Pro reaches the whole library — a free account&apos;s reachable set is the
          rotating daily pair, so the same denominator means something different to it.
        </p>
        <CoverageChart data={retention.coverage} />
        <p className="mt-2 text-[11px] text-muted-foreground">
          {started} of {cohort.registered} registered accounts have opened at least one question.
        </p>
      </Card>

      {/* ── Joining and ranking ─────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <Beaker className="h-4 w-4 text-muted-foreground" /> Signups (last 30 days)
          </h2>
          <SignupsChart data={signups} />
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">Rank distribution</h2>
          <RankDistributionChart data={ranks} />
        </Card>
      </div>
    </div>
  );
}

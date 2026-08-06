"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarPlus,
  CheckCircle2,
  Flame,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { grantPro, revokePro } from "@/app/actions/admin";
import type { AdminUserRow, AdminUserStats } from "@/lib/admin-stats";
import { PRO_PASS_DAYS, proDaysRemaining } from "@/lib/billing";
import { USER_SEGMENT_LABELS, type UserSegment } from "@/lib/user-segment";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { RankDistributionChart, SignupsChart } from "./user-charts";

const segmentVariant: Record<UserSegment, "default" | "secondary" | "muted"> = {
  registered: "default",
  guest: "secondary",
  benchmark: "muted",
};

type SortKey =
  | "name"
  | "pro"
  | "level"
  | "xp"
  | "attempts"
  | "avgScore"
  | "streak"
  | "lastActive"
  | "joined";

/**
 * Granting and revoking a Pro pass.
 *
 * The only way to become Pro today, and not a stopgap — support, comps and
 * refunds need it permanently, and it is what keeps the paid tier usable with
 * no payment gateway configured. When checkout lands, its webhook calls the
 * same `grantPro` action this button does.
 */
function ProCell({ user }: { user: AdminUserRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Recomputed on render rather than sent as a label: a pass that lapsed since
  // the page loaded should read as lapsed.
  const left = proDaysRemaining(user.proUntil ? new Date(user.proUntil) : null);

  function run(action: () => Promise<{ ok: boolean; error?: string }>, done: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "That didn't work.");
        return;
      }
      toast.success(done);
      router.refresh();
    });
  }

  // A guest row is absorbed or deleted at signup, and `tierFor` returns "guest"
  // whatever the column says — so granting one a pass would do nothing at all.
  if (user.segment !== "registered") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      {left > 0 ? (
        <Badge variant="success" className="whitespace-nowrap">
          Pro · {left}d
        </Badge>
      ) : (
        <span className="text-xs text-muted-foreground">Free</span>
      )}
      {PRO_PASS_DAYS.map((days) => (
        <Button
          key={days}
          size="sm"
          variant="ghost"
          disabled={pending}
          className="h-7 px-2 text-xs"
          title={left > 0 ? `Add ${days} days to the pass` : `Grant a ${days}-day pass`}
          onClick={() => run(() => grantPro(user.id, days), `${days} days added`)}
        >
          +{days}
        </Button>
      ))}
      {left > 0 && (
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          className="h-7 px-2 text-xs text-destructive"
          onClick={() => run(() => revokePro(user.id), "Pass revoked")}
        >
          Revoke
        </Button>
      )}
    </div>
  );
}

/** Sorted descending by default — for every column here, "most" is the interesting end. */
const COLUMNS: { key: SortKey; label: string; numeric?: boolean; title?: string }[] = [
  { key: "name", label: "User" },
  {
    key: "pro",
    label: "Pro",
    numeric: true,
    title: "Days left on a Pro pass. Granting again extends it rather than resetting it.",
  },
  { key: "level", label: "Level", numeric: true },
  { key: "xp", label: "XP", numeric: true },
  { key: "attempts", label: "Attempts", numeric: true },
  { key: "avgScore", label: "Avg score", numeric: true },
  { key: "streak", label: "Streak", numeric: true },
  {
    key: "lastActive",
    label: "Last practised",
    title: "Set when an attempt is submitted, not when someone signs in.",
  },
  { key: "joined", label: "Joined" },
];

function sortValue(row: AdminUserRow, key: SortKey): string | number {
  switch (key) {
    case "name":
      return (row.name ?? row.email ?? "").toLowerCase();
    case "pro":
      return row.proUntil ? Date.parse(row.proUntil) : 0;
    case "level":
      return row.level;
    case "xp":
      return row.xp;
    case "attempts":
      return row.attempts;
    case "avgScore":
      return row.avgScore ?? -1;
    case "streak":
      return row.streak;
    case "lastActive":
      return row.lastActiveDate ?? "";
    case "joined":
      return row.createdAt;
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function UserDashboard({ stats }: { stats: AdminUserStats }) {
  const [segment, setSegment] = useState<UserSegment | "all">("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "joined", desc: true });

  const cards = [
    { label: "Registered", value: stats.registered, icon: UserRound },
    { label: "Guests", value: stats.guests, icon: Users },
    { label: "Practised (7d)", value: stats.practisedRecently, icon: Flame },
    { label: "New (7d)", value: stats.newRecently, icon: CalendarPlus },
    { label: "Attempts", value: stats.attempts, icon: CheckCircle2, sub: `${stats.submittedAttempts} submitted` },
    { label: "Avg score", value: stats.avgScore ?? "—", icon: TrendingUp, sub: "across all evaluations" },
  ];

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = stats.users.filter((u) => {
      // Benchmark rows stay out of "All" — they aren't people, and letting 40 of
      // them into the default view is exactly what the headline counts avoid.
      if (segment === "all" ? u.segment === "benchmark" : u.segment !== segment) return false;
      if (!q) return true;
      return `${u.name ?? ""} ${u.email ?? ""}`.toLowerCase().includes(q);
    });

    return [...filtered].sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);
      if (av === bv) return 0;
      return (av < bv ? -1 : 1) * (sort.desc ? -1 : 1);
    });
  }, [stats.users, segment, query, sort]);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: true }));
  }

  const segments: (UserSegment | "all")[] = ["all", "registered", "guest", "benchmark"];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <Card key={c.label} className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <c.icon className="h-4 w-4" />
              <span className="text-xs">{c.label}</span>
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{c.value}</div>
            {c.sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{c.sub}</div>}
          </Card>
        ))}
      </div>

      {/* Say where the numbers come from. Without this the counts look wrong to
          anyone who knows the table holds 42 rows on a fresh install. */}
      <p className="text-xs text-muted-foreground">
        Counts cover real accounts only. {stats.benchmark} synthetic benchmark account
        {stats.benchmark === 1 ? " is" : "s are"} excluded — they exist to give the percentile
        rank a starting population, and are visible under the Benchmark filter below.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">Signups (last 30 days)</h2>
          <SignupsChart data={stats.signups} />
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">Rank distribution</h2>
          <RankDistributionChart data={stats.ranks} />
        </Card>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {segments.map((s) => (
              <button
                key={s}
                onClick={() => setSegment(s)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs",
                  segment === s
                    ? "border-primary bg-primary/5 text-primary"
                    : "text-muted-foreground",
                )}
              >
                {s === "all" ? "All real users" : USER_SEGMENT_LABELS[s]}
              </button>
            ))}
          </div>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email…"
            className="h-9 max-w-xs"
          />
        </div>

        {stats.truncated && (
          <p className="text-xs text-warning">
            Showing the most recent {stats.users.length} accounts only.
          </p>
        )}

        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No users in this view.
          </p>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  {COLUMNS.map((c) => (
                    <th
                      key={c.key}
                      title={c.title}
                      className={cn("whitespace-nowrap p-3 font-medium", c.numeric && "text-right")}
                    >
                      <button
                        onClick={() => toggleSort(c.key)}
                        className={cn(
                          "hover:text-foreground",
                          sort.key === c.key && "text-foreground",
                        )}
                      >
                        {c.label}
                        {sort.key === c.key && (sort.desc ? " ↓" : " ↑")}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((u) => (
                  <tr key={u.id} className="hover:bg-accent/40">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {u.name || "Unnamed"}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {u.email ?? "no email"}
                          </div>
                        </div>
                        <Badge variant={segmentVariant[u.segment]}>
                          {USER_SEGMENT_LABELS[u.segment]}
                        </Badge>
                        {u.role === "admin" && <Badge variant="warning">Admin</Badge>}
                        {u.rank && <Badge variant="outline">{u.rank}</Badge>}
                      </div>
                    </td>
                    <td className="p-3">
                      <ProCell user={u} />
                    </td>
                    <td className="p-3 text-right tabular-nums">{u.level}</td>
                    <td className="p-3 text-right tabular-nums">{u.xp}</td>
                    <td className="p-3 text-right tabular-nums">{u.attempts}</td>
                    <td className="p-3 text-right tabular-nums">{u.avgScore ?? "—"}</td>
                    <td className="p-3 text-right tabular-nums">{u.streak}</td>
                    <td className="whitespace-nowrap p-3 text-muted-foreground">
                      {formatDate(u.lastActiveDate)}
                    </td>
                    <td className="whitespace-nowrap p-3 text-muted-foreground">
                      {formatDate(u.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}

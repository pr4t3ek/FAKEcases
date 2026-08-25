"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Loader2, Pin, PinOff } from "lucide-react";
import { toast } from "sonner";
import { clearDailyUnlock, setAllFreeTier, setDailyUnlock } from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export interface DailyRow {
  day: string;
  slot: string;
  questionId: string | null;
  questionTitle: string | null;
  pinned: boolean;
}

export interface PickableQuestion {
  id: string;
  title: string;
  type: string;
  difficulty: string;
}

const SLOT_LABEL: Record<string, string> = {
  guesstimate: "Guesstimate",
  simulation: "War room",
};

/**
 * What the cohort works on, day by day.
 *
 * Reading this screen, the thing to understand is that **most rows are not
 * stored anywhere**. A day with no pin still shows a question, because
 * `lib/daily-unlock.ts` derives one from the date. That is why every row says
 * whether it was pinned or auto-picked: without it, an admin would have no way
 * to tell a decision they made from one the calendar made for them, and would
 * reasonably assume a blank day meant a blank day for the students too.
 *
 * The consequence worth internalising: **doing nothing is a valid way to run
 * this.** Pinning is for the days that matter — the one after the lecture, the
 * one before the exam.
 */
export function DailyManager({
  rows,
  guesstimates,
  warRooms,
  lockedCount,
  totalCount,
}: {
  rows: DailyRow[];
  guesstimates: PickableQuestion[];
  warRooms: PickableQuestion[];
  lockedCount: number;
  totalCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string }>, done: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "That didn't work.");
        return;
      }
      toast.success(done);
      setEditing(null);
      router.refresh();
    });
  }

  const byDay = rows.reduce<Record<string, DailyRow[]>>((acc, r) => {
    (acc[r.day] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* The launch configuration, as one control. Locking 65 questions by hand
          is not a decision, it is an afternoon with a mistake in it. */}
      <Card className="space-y-3 p-5">
        <div>
          <h2 className="font-semibold">Catalogue</h2>
          <p className="text-sm text-muted-foreground">
            {lockedCount} of {totalCount} questions are locked. A locked catalogue means the
            daily unlock below is the only way in — which is the point, but it also means
            unlocking everything here overrides it entirely.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => run(() => setAllFreeTier(false), "Everything locked")}
          >
            Lock everything
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => run(() => setAllFreeTier(true), "Everything unlocked")}
          >
            Unlock everything
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <CalendarDays className="h-4 w-4" /> The next week
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every day already has a question. Pin one only where you want to override the
            rotation — a day you leave alone still opens something for the class.
          </p>
        </div>

        <div className="divide-y">
          {Object.entries(byDay).map(([day, slots]) => (
            <div key={day} className="p-4">
              <div className="mb-2 text-xs font-medium tabular-nums text-muted-foreground">
                {day}
              </div>
              <div className="space-y-2">
                {slots.map((row) => {
                  const key = `${row.day}:${row.slot}`;
                  const pool = row.slot === "guesstimate" ? guesstimates : warRooms;

                  return (
                    <div key={key} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="w-24 shrink-0 text-muted-foreground">
                        {SLOT_LABEL[row.slot] ?? row.slot}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {row.questionTitle ?? (
                          <span className="text-muted-foreground">
                            nothing available — seed some {row.slot}s
                          </span>
                        )}
                      </span>
                      <Badge variant={row.pinned ? "default" : "muted"}>
                        {row.pinned ? "pinned" : "auto"}
                      </Badge>

                      {editing === key ? (
                        <select
                          autoFocus
                          disabled={pending}
                          defaultValue=""
                          onChange={(e) =>
                            e.target.value &&
                            run(
                              () => setDailyUnlock(row.day, row.slot, e.target.value),
                              "Pinned",
                            )
                          }
                          className="rounded-md border bg-background px-2 py-1 text-xs"
                        >
                          <option value="">Choose a question…</option>
                          {pool.map((q) => (
                            <option key={q.id} value={q.id}>
                              {q.title} ({q.difficulty})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          disabled={pending}
                          onClick={() => setEditing(key)}
                        >
                          <Pin className="h-3 w-3" /> Pin
                        </Button>
                      )}

                      {row.pinned && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-destructive"
                          disabled={pending}
                          title="Hand this day back to the automatic rotation"
                          onClick={() =>
                            run(() => clearDailyUnlock(row.day, row.slot), "Back to auto")
                          }
                        >
                          <PinOff className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {pending && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Saving…
        </p>
      )}
    </div>
  );
}

/**
 * The turn budgets.
 *
 * Editable here rather than only in code because the number that is right for a
 * class is not knowable before the class: the alternative to this card is a
 * redeploy between lectures.
 */
export function LimitsCard({ limits }: { limits: Record<string, number> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState(limits);

  const FIELDS: { key: string; label: string; hint: string }[] = [
    {
      key: "messagesPerAttempt",
      label: "Turns per question",
      hint: "How many messages a student may send on one question before they must submit.",
    },
    {
      key: "messagesPerMinute",
      label: "Turns per minute",
      hint: "Guards against a held-down Enter key, not against a fast thinker.",
    },
    {
      key: "userMessagesPerHour",
      label: "Messages per hour",
      hint: "Past this the interviewer degrades to the offline mock rather than refusing.",
    },
    {
      key: "globalRequestsPerDay",
      label: "Whole-site daily cap",
      hint: "Everyone's spend combined. Off by default — turn it on if the provider bill looks wrong.",
    },
  ];

  function save(key: string) {
    startTransition(async () => {
      const result = await import("@/app/actions/admin").then((m) =>
        m.updateLimit(key, draft[key]),
      );
      if (!result.ok) {
        toast.error(result.error ?? "That didn't work.");
        return;
      }
      toast.success("Limit updated");
      router.refresh();
    });
  }

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="font-semibold">Limits</h2>
        <p className="text-sm text-muted-foreground">
          Applies immediately, with no redeploy. <strong>0 disables a limit</strong> rather
          than blocking everything.
        </p>
      </div>

      <div className="space-y-3">
        {FIELDS.map((f) => (
          <div key={f.key} className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{f.label}</div>
              <div className="text-xs text-muted-foreground">{f.hint}</div>
            </div>
            <Input
              type="number"
              min={0}
              value={draft[f.key] ?? 0}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: Number(e.target.value) }))}
              className="h-8 w-24 tabular-nums"
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={pending || draft[f.key] === limits[f.key]}
              onClick={() => save(f.key)}
            >
              Save
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

/**
 * The address a locked-out student is told to write to.
 *
 * Lives beside `LimitsCard` because it is the same kind of thing: a value the
 * person running the deployment has to be able to correct without a redeploy.
 * This one is a mailbox rather than a number, so it will change hands — a
 * professor takes over next term, or the launch moves to a shared address — and
 * `/forgot-password` has to follow it.
 */
export function ContactEmailCard({ email }: { email: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState(email);

  function save() {
    startTransition(async () => {
      const result = await import("@/app/actions/admin").then((m) =>
        m.updateContactEmail(draft),
      );
      if (!result.ok) {
        toast.error(result.error ?? "That didn't work.");
        return;
      }
      toast.success("Contact address updated");
      router.refresh();
    });
  }

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="font-semibold">Password-reset contact</h2>
        <p className="text-sm text-muted-foreground">
          Printed on <strong>/forgot-password</strong>, where students are told to write in from
          their college address. Whoever reads this mailbox is who resets passwords, using the key
          button on the Users tab.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="email"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="h-8 min-w-0 flex-1"
          placeholder="you@college.ac.in"
        />
        <Button size="sm" variant="secondary" disabled={pending || draft.trim() === email} onClick={save}>
          Save
        </Button>
      </div>
    </Card>
  );
}

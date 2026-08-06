"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  checkScenarioDrivers,
  resetScenarioDrivers,
  saveScenarioDrivers,
} from "@/app/actions/sim-scenarios";
import type { SimDriver } from "@/lib/sim/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/** A scenario as the editor needs it — everything already serialised. */
export interface ScenarioRow {
  slug: string;
  title: string;
  company: string;
  difficulty: string;
  northStar: string;
  /** The graph in effect: the override when one is stored and holds, else code. */
  currentJson: string;
  /** The authored graph, so "reset" can be shown as a real difference. */
  baseJson: string;
  overridden: boolean;
  /** Set when a stored override was refused at load and code is being served. */
  rejected?: string;
  note: string | null;
  updatedAt: string | null;
  updatedByName: string | null;
  /** Driver ids an intervention or the drift actually moves. */
  leverIds: string[];
}

/** A driver's editable number, by kind. Derived drivers have none. */
function editableValue(driver: SimDriver): number | null {
  if (driver.kind === "input") return driver.baseline;
  if (driver.kind === "constant") return driver.value;
  return null;
}

/** How a derived driver is computed, for the read-only column. */
function formulaOf(driver: SimDriver): string {
  switch (driver.kind) {
    case "input":
      return "baseline";
    case "constant":
      return "fixed";
    case "product":
      return driver.of.join(" × ");
    case "sum":
      return driver.of.join(" + ");
    case "difference":
      return `${driver.minuend} − ${driver.subtrahend}`;
    case "quotient":
      return `${driver.numerator} ÷ ${driver.denominator}`;
  }
}

export function ScenarioManager({ scenarios }: { scenarios: ScenarioRow[] }) {
  const router = useRouter();
  const [slug, setSlug] = useState(scenarios[0]?.slug ?? "");
  const selected = scenarios.find((s) => s.slug === slug);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
        <strong>Code is the default.</strong> The scenarios in{" "}
        <code className="rounded bg-muted px-1">lib/sim/scenarios</code> are what ships. Saving here
        stores an <em>override</em> of one scenario&apos;s driver graph; resetting deletes it and the
        scenario tracks the code again. Every save is checked for structure, cross-references and
        balance — an edit that lets some other allocation beat the declared best one is refused,
        because that is the ceiling outcome scores are measured against.
      </div>

      <div className="flex flex-wrap gap-2">
        {scenarios.map((s) => (
          <button
            key={s.slug}
            onClick={() => setSlug(s.slug)}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              s.slug === slug ? "bg-primary text-primary-foreground" : "hover:bg-accent"
            }`}
          >
            {s.title}
            {s.rejected ? (
              <Badge variant="destructive" className="ml-2">!</Badge>
            ) : s.overridden ? (
              <Badge variant="secondary" className="ml-2">edited</Badge>
            ) : null}
          </button>
        ))}
      </div>

      {selected && <ScenarioEditor key={selected.slug} scenario={selected} onDone={() => router.refresh()} />}
    </div>
  );
}

function ScenarioEditor({
  scenario,
  onDone,
}: {
  scenario: ScenarioRow;
  onDone: () => void;
}) {
  const [json, setJson] = useState(scenario.currentJson);
  const [note, setNote] = useState(scenario.note ?? "");
  const [tab, setTab] = useState<"numbers" | "graph">("numbers");
  const [errors, setErrors] = useState<string[] | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /**
   * Half-typed numbers, keyed by driver id.
   *
   * The JSON text is the single source of truth, so a keystroke would otherwise
   * round-trip through `JSON.stringify` and turn "1." into "1" as you type the
   * decimal point. These hold the raw string until blur.
   */
  const [pending, setPending] = useState<Record<string, string>>({});

  const dirty = json !== scenario.currentJson || note !== (scenario.note ?? "");
  const parsed = safeParse(json);
  const authored = safeParse(scenario.baseJson);
  const changed = parsed && authored ? changedDriverIds(authored, parsed) : [];

  function commitDriverValue(id: string, raw: string) {
    setPending((p) => {
      const next = { ...p };
      delete next[id];
      return next;
    });
    const value = Number(raw);
    if (raw.trim() === "" || Number.isNaN(value)) return;
    if (!parsed) return;

    const next = parsed.map((d) =>
      d.id !== id
        ? d
        : d.kind === "input"
          ? { ...d, baseline: value }
          : d.kind === "constant"
            ? { ...d, value }
            : d,
    );
    setJson(JSON.stringify(next, null, 2));
    setErrors(null);
    setOkMessage(null);
  }

  function commitLabel(id: string, label: string) {
    if (!parsed) return;
    setJson(JSON.stringify(parsed.map((d) => (d.id === id ? { ...d, label } : d)), null, 2));
    setErrors(null);
    setOkMessage(null);
  }

  async function run(action: "check" | "save") {
    setBusy(true);
    setErrors(null);
    setOkMessage(null);
    try {
      const result =
        action === "check"
          ? await checkScenarioDrivers(scenario.slug, json)
          : await saveScenarioDrivers(scenario.slug, json, note);

      if (!result.ok) {
        setErrors(result.errors ?? ["Save failed."]);
        return;
      }
      if (action === "check") {
        setOkMessage("Structure, cross-references and balance all hold.");
      } else {
        toast.success(`Saved ${scenario.title}`);
        onDone();
      }
    } catch {
      toast.error("Something went wrong. You may no longer be signed in as an admin.");
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    try {
      await resetScenarioDrivers(scenario.slug);
      toast.success(`${scenario.title} is back to the authored graph`);
      onDone();
    } catch {
      toast.error("Reset failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-semibold">
            {scenario.title} <span className="text-muted-foreground">· {scenario.company}</span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            North star: <code className="rounded bg-muted px-1">{scenario.northStar}</code> ·{" "}
            {scenario.difficulty}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {scenario.overridden ? (
            <Badge variant="secondary">
              Edited
              {scenario.updatedByName ? ` by ${scenario.updatedByName}` : ""}
              {scenario.updatedAt ? ` · ${new Date(scenario.updatedAt).toLocaleDateString()}` : ""}
            </Badge>
          ) : (
            <Badge variant="success">Authored</Badge>
          )}
          {scenario.overridden && (
            <Button variant="outline" size="sm" onClick={reset} disabled={busy}>
              <RotateCcw className="h-4 w-4" /> Reset to authored
            </Button>
          )}
        </div>
      </div>

      {scenario.rejected && (
        <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <strong>A stored override for this scenario was refused, and students are seeing the
          authored version.</strong>{" "}
          This happens when a code change moves something the override still points at. The reason
          given was: <span className="text-destructive">{scenario.rejected}</span>
        </div>
      )}

      {changed.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {changed.length} of {authored?.length ?? 0} drivers differ from the authored graph:{" "}
          {changed.slice(0, 8).map((id) => (
            <code key={id} className="mr-1 rounded bg-muted px-1">
              {id}
            </code>
          ))}
          {changed.length > 8 && `and ${changed.length - 8} more`}
        </p>
      )}

      <div className="mt-4 inline-flex rounded-md border p-0.5">
        {(["numbers", "graph"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded px-3 py-1 text-sm ${tab === t ? "bg-primary text-primary-foreground" : ""}`}
          >
            {t === "numbers" ? "Numbers" : "Whole graph (JSON)"}
          </button>
        ))}
      </div>

      {tab === "numbers" ? (
        !parsed ? (
          <p className="mt-4 text-sm text-destructive">
            The JSON below is not readable, so the table can&apos;t be shown. Fix it on the
            &ldquo;Whole graph&rdquo; tab.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="pb-2 pr-3 font-medium">Driver</th>
                  <th className="pb-2 pr-3 font-medium">Label</th>
                  <th className="pb-2 pr-3 font-medium">Kind</th>
                  <th className="pb-2 pr-3 font-medium">Value / formula</th>
                  <th className="pb-2 font-medium">Unit</th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((d) => {
                  const value = editableValue(d);
                  const isLever = scenario.leverIds.includes(d.id);
                  return (
                    <tr key={d.id} className={`border-t ${changed.includes(d.id) ? "bg-primary/5" : ""}`}>
                      <td className="py-2 pr-3 align-middle">
                        <code className="rounded bg-muted px-1 text-xs">{d.id}</code>
                        {isLever && (
                          <span
                            className="ml-1.5 text-xs text-muted-foreground"
                            title="An intervention or the drift moves this driver"
                          >
                            lever
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <Input
                          defaultValue={d.label}
                          onBlur={(e) => commitLabel(d.id, e.target.value)}
                          className="h-8 min-w-[12rem] text-sm"
                        />
                      </td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">{d.kind}</td>
                      <td className="py-2 pr-3">
                        {value === null ? (
                          <span className="text-xs text-muted-foreground">{formulaOf(d)}</span>
                        ) : (
                          <Input
                            value={pending[d.id] ?? String(value)}
                            onChange={(e) =>
                              setPending((p) => ({ ...p, [d.id]: e.target.value }))
                            }
                            onBlur={(e) => commitDriverValue(d.id, e.target.value)}
                            inputMode="decimal"
                            className="h-8 w-40 text-sm"
                          />
                        )}
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">{d.unit}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted-foreground">
              Only <code className="rounded bg-muted px-1">input</code> and{" "}
              <code className="rounded bg-muted px-1">constant</code> drivers carry a number of their
              own — everything else is computed from its parents, which is what stops two figures on
              the dashboard from disagreeing. To add, remove or re-wire a driver, use the whole-graph
              tab.
            </p>
          </div>
        )
      ) : (
        <Textarea
          value={json}
          onChange={(e) => {
            setJson(e.target.value);
            setErrors(null);
            setOkMessage(null);
          }}
          spellCheck={false}
          className="mt-4 min-h-[420px] font-mono text-xs"
        />
      )}

      <div className="mt-4">
        <label className="text-xs text-muted-foreground" htmlFor={`note-${scenario.slug}`}>
          Why you changed it
        </label>
        <Input
          id={`note-${scenario.slug}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. CPM raised to the 2026 media rate"
          className="mt-1 text-sm"
        />
      </div>

      {errors && (
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-3">
          <div className="text-sm font-semibold text-destructive">
            Not saved — {errors.length} problem{errors.length === 1 ? "" : "s"}
          </div>
          <ul className="mt-2 space-y-1 text-xs text-destructive">
            {errors.slice(0, 20).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {okMessage && (
        <div className="mt-4 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
          {okMessage}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => run("check")} disabled={busy}>
          <ShieldCheck className="h-4 w-4" /> Check
        </Button>
        <Button onClick={() => run("save")} disabled={busy || !dirty}>
          <Save className="h-4 w-4" /> Save override
        </Button>
        {dirty && (
          <Button
            variant="ghost"
            onClick={() => {
              setJson(scenario.currentJson);
              setNote(scenario.note ?? "");
              setPending({});
              setErrors(null);
              setOkMessage(null);
            }}
            disabled={busy}
          >
            Discard changes
          </Button>
        )}
      </div>
    </Card>
  );
}

function safeParse(json: string): SimDriver[] | null {
  try {
    const data = JSON.parse(json);
    return Array.isArray(data) ? (data as SimDriver[]) : null;
  } catch {
    return null;
  }
}

/**
 * Key order is not meaning, so compare on sorted entries.
 *
 * Without this, re-serialising a driver the editor never touched would read as a
 * change, and the "differs from authored" count — the one thing telling an admin
 * how far they have moved from the shipped scenario — would always be everything.
 */
function canonical(driver: SimDriver): string {
  const entries = Object.entries(driver as unknown as Record<string, unknown>);
  entries.sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

/** Driver ids that differ from the authored graph, added or removed included. */
function changedDriverIds(base: SimDriver[], next: SimDriver[]): string[] {
  const before = new Map(base.map((d) => [d.id, canonical(d)]));
  const after = new Map(next.map((d) => [d.id, canonical(d)]));

  const ids = new Set<string>();
  for (const [id, sig] of after) if (before.get(id) !== sig) ids.add(id);
  for (const id of before.keys()) if (!after.has(id)) ids.add(id);
  return [...ids];
}

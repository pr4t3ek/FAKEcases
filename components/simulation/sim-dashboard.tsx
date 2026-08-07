"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { CHART_TICK, CHART_TOOLTIP_STYLE } from "@/components/dashboard/charts";
import { assertNever, cn } from "@/lib/utils";
import { inScale, moneyScaleFor } from "./money";
import type { SimPanel, SimStatementLine, SimUnit, GoodDirection } from "@/lib/sim/types";
import { formatValue } from "./format";

/**
 * Renders the analytics board.
 *
 * `SimPanel` is a discriminated union and the switch is exhaustive, so adding a
 * panel kind is a compile error here rather than a blank space on the page.
 */

export { formatValue };

/** Colour a change by whether it moved the way the metric wants. */
function deltaTone(deltaPct: number, goodDirection: GoodDirection = "up"): string {
  if (Math.abs(deltaPct) < 0.001) return "text-muted-foreground";
  const good = deltaPct > 0 === (goodDirection === "up");
  return good ? "text-success" : "text-destructive";
}

export function DeltaLabel({
  deltaPct,
  goodDirection = "up",
}: {
  deltaPct: number;
  goodDirection?: GoodDirection;
}) {
  const sign = deltaPct > 0 ? "+" : "";
  return (
    <span className={cn("text-xs font-medium tabular-nums", deltaTone(deltaPct, goodDirection))}>
      {sign}
      {(deltaPct * 100).toFixed(1)}%
    </span>
  );
}

/**
 * A share axis has to be labelled the way the tiles above it are. Left raw, a
 * match-rate axis reads "0.84" three inches under a stat tile reading "79.0%",
 * and the reader has to do the conversion to see they are the same number.
 * Only the share-like units get this — a rupee axis formatted to "₹41.14 cr"
 * would not fit the gutter.
 */
const SHARE_UNITS = new Set<SimUnit>(["ratio", "percent", "multiple"]);

/** What the first column of each statement is a list of. */
const STATEMENT_NOUN: Record<"pnl" | "balance" | "cashflow", string> = {
  pnl: "Statement of profit and loss",
  balance: "Balance sheet",
  cashflow: "Cash flow statement",
};

const SERIES_STROKES = [
  "hsl(var(--primary))",
  "hsl(var(--warning))",
  "hsl(var(--muted-foreground))",
];

function PanelShell({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {caption && <p className="mt-0.5 text-xs text-muted-foreground">{caption}</p>}
      </div>
      {children}
    </Card>
  );
}

export function SimPanelView({ panel }: { panel: SimPanel }) {
  switch (panel.kind) {
    case "timeseries": {
      // Recharts wants one row per period with a key per series.
      const periods = panel.series[0]?.points.map((p) => p.period) ?? [];
      const data = periods.map((period, i) => {
        const row: Record<string, string | number> = { period };
        for (const s of panel.series) row[s.label] = s.points[i]?.value ?? 0;
        return row;
      });
      /**
       * Two series on one axis only works while they are the same size. Share
       * against net contribution, or revenue in lakh against a ticket count, is
       * a 10x to 25x span — and the whole point of those panels is "these two
       * lines moved in opposite directions", which you cannot see when one of
       * them is pinned to the floor. Past a 5x span each series gets its own
       * axis, tinted to match its line so it is obvious which is which.
       */
      const spans = panel.series.map((se) =>
        Math.max(...se.points.map((pt) => Math.abs(pt.value)), 0),
      );
      const spread = Math.max(...spans) / Math.max(Math.min(...spans), 1e-9);
      const dual = panel.series.length === 2 && spread >= 5;
      // Spread rather than `yAxisId={undefined}`: Recharts resolves the axis by
      // id and an explicitly-undefined prop does not fall back to its default,
      // so passing it on a single-axis chart throws "Specifying a yAxisId
      // requires a corresponding yAxisId on the targeted graphical component"
      // and takes the whole page down.
      const axisProps = (i: number) => (dual ? { yAxisId: i === 0 ? "left" : "right" } : {});

      const tickFmt = (unit: SimUnit) =>
        SHARE_UNITS.has(unit) ? (v: number) => formatValue(v, unit) : undefined;
      const sharedUnit = panel.series.every((se) => se.unit === panel.series[0]?.unit)
        ? panel.series[0]?.unit
        : undefined;

      return (
        <PanelShell title={panel.title} caption={panel.caption}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart
              data={data}
              // The single-axis case pulls left to reclaim the gutter; with an
              // axis on both sides there is no gutter to reclaim, and pulling
              // clipped both the tick labels and the first period.
              margin={dual ? { top: 6, right: 2, bottom: 0, left: 2 } : { top: 6, right: 8, bottom: 0, left: -12 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="period" tick={CHART_TICK} />
              {/* Listed flat, never wrapped in a fragment: Recharts inspects its
                  direct children by type to build the chart and does not recurse
                  into one, so a fragment here silently drops both axes — the
                  lines still get implicit per-id scales, which is what made it
                  look like it worked. */}
              {dual && (
                <YAxis
                  yAxisId="left"
                  width={46}
                  tick={{ ...CHART_TICK, fill: SERIES_STROKES[0] }}
                  tickFormatter={tickFmt(panel.series[0].unit)}
                  domain={["auto", "auto"]}
                />
              )}
              {dual && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  width={46}
                  tick={{ ...CHART_TICK, fill: SERIES_STROKES[1] }}
                  tickFormatter={tickFmt(panel.series[1].unit)}
                  domain={["auto", "auto"]}
                />
              )}
              {!dual && (
                <YAxis
                  tick={CHART_TICK}
                  tickFormatter={sharedUnit ? tickFmt(sharedUnit) : undefined}
                  domain={["auto", "auto"]}
                />
              )}
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              {panel.series.map((s, i) => (
                <Line
                  key={s.label}
                  type="monotone"
                  dataKey={s.label}
                  {...axisProps(i)}
                  stroke={SERIES_STROKES[i % SERIES_STROKES.length]}
                  strokeWidth={2.5}
                  dot={{ r: 2.5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          {panel.series.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-3">
              {panel.series.map((s, i) => (
                <span key={s.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: SERIES_STROKES[i % SERIES_STROKES.length] }}
                  />
                  {s.label}
                </span>
              ))}
            </div>
          )}
        </PanelShell>
      );
    }

    case "stat":
      return (
        <PanelShell title={panel.title} caption={panel.caption}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {panel.tiles.map((tile) => (
              <div key={tile.label} className="rounded-lg border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">{tile.label}</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">
                  {formatValue(tile.value, tile.unit)}
                </div>
                {tile.deltaPct !== undefined && (
                  <DeltaLabel deltaPct={tile.deltaPct} goodDirection={tile.goodDirection} />
                )}
              </div>
            ))}
          </div>
        </PanelShell>
      );

    case "funnel": {
      const top = panel.steps[0]?.value || 1;
      return (
        <PanelShell title={panel.title} caption={panel.caption}>
          <div className="space-y-2">
            {panel.steps.map((step) => (
              <div key={step.label}>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-medium">{step.label}</span>
                  <span className="flex items-center gap-2 text-muted-foreground tabular-nums">
                    {formatValue(step.value, "count")}
                    {step.deltaPct !== undefined && <DeltaLabel deltaPct={step.deltaPct} />}
                  </span>
                </div>
                {/* Proportional bars rather than a chart library: a funnel is a
                    row of widths, and this keeps it readable at any size. */}
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full rounded-full bg-primary/70"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(2, (step.value / top) * 100)}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </PanelShell>
      );
    }

    case "segments": {
      /**
       * Two different panels wear this one name, and rendering both as a change
       * chart is why 34 of them shipped blank: a panel comparing *changes* has a
       * deltaPct per row, and a panel comparing *levels* — conversion by zone,
       * cost per pack by channel — has none, so every bar came out zero-width
       * under an axis Recharts had labelled "0% … 4%".
       *
       * So the chart follows the data. Changes keep the axis, because a change
       * is a single comparable quantity across rows. Levels get a proportional
       * bar behind each row instead: rows can be in different units, and the
       * value beside the bar already says which.
       *
       * `every`, not `some` — Chaska's channel panel puts a delta on its two
       * "now" rows and none on the two "a year ago" rows they are measured
       * against, and the change chart drew those baselines as nothing at all.
       */
      const hasDeltas = panel.rows.length > 0 && panel.rows.every((r) => r.deltaPct !== undefined);

      if (hasDeltas) {
        const data = panel.rows.map((r) => ({
          label: r.label,
          change: (r.deltaPct ?? 0) * 100,
        }));
        return (
          <PanelShell title={panel.title} caption={panel.caption}>
            <ResponsiveContainer width="100%" height={Math.max(140, panel.rows.length * 46)}>
              <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={CHART_TICK} unit="%" />
                <YAxis type="category" dataKey="label" tick={CHART_TICK} width={130} />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(v: number) => [`${v.toFixed(1)}%`, "Change"]}
                />
                <Bar dataKey="change" radius={[0, 4, 4, 0]} fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1">
              {panel.rows.map((r) => (
                <div key={r.label} className="flex items-baseline justify-between text-xs">
                  <span className="text-muted-foreground">
                    {panel.dimension}: <span className="text-foreground">{r.label}</span>
                  </span>
                  <span className="flex items-center gap-2 tabular-nums">
                    {formatValue(r.value, r.unit)}
                    {r.deltaPct !== undefined && <DeltaLabel deltaPct={r.deltaPct} />}
                  </span>
                </div>
              ))}
            </div>
          </PanelShell>
        );
      }

      // Same proportional bar the funnel uses, for the same reason: it survives
      // any magnitude and needs no axis to be read.
      const top = Math.max(...panel.rows.map((r) => Math.abs(r.value)), 1);
      return (
        <PanelShell title={panel.title} caption={panel.caption}>
          <div className="mt-1 space-y-2.5">
            {panel.rows.map((r) => (
              <div key={r.label}>
                <div className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="min-w-0 text-muted-foreground">{r.label}</span>
                  <span className="flex shrink-0 items-center gap-2 tabular-nums">
                    <span className="font-medium text-foreground">
                      {formatValue(r.value, r.unit)}
                    </span>
                    {r.deltaPct !== undefined && <DeltaLabel deltaPct={r.deltaPct} />}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full rounded-full bg-primary/70"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(2, (Math.abs(r.value) / top) * 100)}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-[11px] text-muted-foreground">Cut by {panel.dimension}</div>
        </PanelShell>
      );
    }
    case "note":
      return (
        <PanelShell title={panel.title}>
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {panel.body}
          </p>
        </PanelShell>
      );

    case "statement": {
      /**
       * A statement is rendered as a document rather than as a chart, because
       * the layout is the lesson: subtotals ruled off from the lines that make
       * them, components indented under their parent, and last year in the
       * column beside this year so the comparison needs no arithmetic.
       *
       * The change column is authored per line rather than computed for all of
       * them: a percentage change on a line that crossed zero — operating
       * profit going from ₹2 cr to −₹1 cr — is a number with no meaning, and
       * printing "−150%" beside it would teach a reader to trust it.
       */
      const comparative = panel.periods.length === 2;

      /**
       * Growth in the *size* of the line, not in its signed value.
       *
       * Cost lines are authored negative so the statement subtracts down the
       * page, and on the signed value a cost rising from −34 to −43 comes out
       * as "−25%" — which reads as a cost that fell. What a reader of a
       * statement means by "cost of goods is up 25%" is the magnitude, so that
       * is what is shown, and `goodDirection` supplies the colour.
       */
      const changeOf = (line: SimStatementLine): number | null => {
        if (line.priorValue === undefined || line.priorValue === 0) return null;
        // A line that crossed zero has no meaningful percentage — an operating
        // profit going from ₹2 cr to −₹1 cr is not "−150%".
        if (line.priorValue < 0 !== line.value < 0) return null;
        return (Math.abs(line.value) - Math.abs(line.priorValue)) / Math.abs(line.priorValue);
      };

      /**
       * One money scale for the whole statement, chosen from its largest line.
       *
       * `formatValue` picks lakh or crore per value, which is right for a stat
       * tile standing on its own and wrong in a column: it printed "−₹1.30 cr"
       * directly above "−75.00 L" for the same line in two years, and a reader
       * comparing them has to rescale in their head. A statement is a column of
       * numbers in one unit, as its caption promises.
       */
      const money = panel.unit === "inr";
      const scale = money
        ? moneyScaleFor(
            Math.max(
              ...panel.sections
                .flatMap((s) => s.lines)
                .flatMap((l) => [Math.abs(l.value), Math.abs(l.priorValue ?? 0)]),
              0,
            ),
          )
        : null;
      // "−₹42.85 cr", not "₹-42.85 cr". The sign belongs to the amount, not
      // between the currency symbol and its digits.
      const render = (value: number) => {
        if (!scale) return formatValue(value, panel.unit);
        const magnitude = inScale(Math.abs(value), scale, 2);
        return value < 0 ? `−${magnitude}` : magnitude;
      };

      return (
        <PanelShell title={panel.title} caption={panel.caption}>
          {/* Statements are wide and phones are not. */}
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[22rem] border-collapse text-sm">
              <thead>
                <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="pb-1.5 text-left font-medium">{STATEMENT_NOUN[panel.statement]}</th>
                  {panel.periods.map((period) => (
                    <th key={period} className="pb-1.5 pl-3 text-right font-medium">
                      {period}
                    </th>
                  ))}
                  {comparative && <th className="pb-1.5 pl-3 text-right font-medium">Change</th>}
                </tr>
              </thead>
              {panel.sections.map((section, si) => (
                <tbody key={section.title ?? si}>
                  {section.title && (
                    <tr>
                      <td
                        colSpan={2 + panel.periods.length}
                        className="pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        {section.title}
                      </td>
                    </tr>
                  )}
                  {section.lines.map((line) => {
                    const change = changeOf(line);
                    return (
                      <tr
                        key={line.label}
                        className={cn(
                          "align-baseline",
                          line.emphasis && "border-t font-semibold",
                        )}
                      >
                        <td className={cn("py-1 pr-3", line.indent && "pl-4")}>
                          <span className={cn(!line.emphasis && "text-muted-foreground")}>
                            {line.label}
                          </span>
                          {line.note && (
                            <span className="block text-[11px] font-normal leading-snug text-muted-foreground/80">
                              {line.note}
                            </span>
                          )}
                        </td>
                        <td className="py-1 pl-3 text-right tabular-nums">
                          {render(line.value)}
                        </td>
                        {comparative && (
                          <td className="py-1 pl-3 text-right tabular-nums text-muted-foreground">
                            {line.priorValue === undefined ? "—" : render(line.priorValue)}
                          </td>
                        )}
                        {comparative && (
                          <td className="py-1 pl-3 text-right">
                            {change === null ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : line.goodDirection ? (
                              <DeltaLabel deltaPct={change} goodDirection={line.goodDirection} />
                            ) : (
                              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                                {change > 0 ? "+" : ""}
                                {(change * 100).toFixed(1)}%
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </div>
        </PanelShell>
      );
    }

    default:
      return assertNever(panel, "panel kind");
  }
}

const FULL_WIDTH_PANELS = new Set<SimPanel["kind"]>(["stat", "statement"]);

export function SimDashboard({ panels }: { panels: SimPanel[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {panels.map((panel) => (
        // A statement takes the full width for the same reason a stat row does:
        // it is a wide table, and half a grid column turns every line into two.
        <div
          key={panel.id}
          className={FULL_WIDTH_PANELS.has(panel.kind) ? "lg:col-span-2" : undefined}
        >
          <SimPanelView panel={panel} />
        </div>
      ))}
    </div>
  );
}

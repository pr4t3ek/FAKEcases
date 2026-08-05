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
import { assertNever, cn, formatIndianNumber, toIndianWords } from "@/lib/utils";
import type { SimPanel, SimUnit, GoodDirection } from "@/lib/sim/types";

/**
 * Renders the analytics board.
 *
 * `SimPanel` is a discriminated union and the switch is exhaustive, so adding a
 * panel kind is a compile error here rather than a blank space on the page.
 */

/** Formatting lives at this edge only — the causal model never rounds. */
export function formatValue(value: number, unit: SimUnit): string {
  switch (unit) {
    case "percent":
      return `${(value * 100).toFixed(1)}%`;
    case "ratio":
      // Ratios in this app are conversion-like, so they read better as percent.
      return `${(value * 100).toFixed(1)}%`;
    case "multiple":
      return `${value.toFixed(1)}×`;
    case "inr":
      if (Math.abs(value) >= 1e5) return `₹${toIndianWords(value)}`;
      // Sub-₹100 amounts are real money here — a ₹0.18 cost per impression
      // rounded to "₹0", which made the first link of the chain look broken.
      if (Math.abs(value) < 100 && !Number.isInteger(value)) return `₹${value.toFixed(2)}`;
      return `₹${formatIndianNumber(value)}`;
    case "inr_lakh":
      return `₹${value.toFixed(2)} L`;
    case "inr_crore":
      return `₹${value.toFixed(2)} cr`;
    case "minutes":
      return `${Math.round(value)} min`;
    case "days":
      return `${Math.round(value)}d`;
    case "count":
      return value >= 1e5 ? toIndianWords(value) : formatIndianNumber(value);
    default:
      return assertNever(unit, "unit");
  }
}

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
      return (
        <PanelShell title={panel.title} caption={panel.caption}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="period" tick={CHART_TICK} />
              <YAxis tick={CHART_TICK} domain={["auto", "auto"]} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              {panel.series.map((s, i) => (
                <Line
                  key={s.label}
                  type="monotone"
                  dataKey={s.label}
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

    case "note":
      return (
        <PanelShell title={panel.title}>
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {panel.body}
          </p>
        </PanelShell>
      );

    default:
      return assertNever(panel, "panel kind");
  }
}

export function SimDashboard({ panels }: { panels: SimPanel[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {panels.map((panel) => (
        <div key={panel.id} className={panel.kind === "stat" ? "lg:col-span-2" : undefined}>
          <SimPanelView panel={panel} />
        </div>
      ))}
    </div>
  );
}

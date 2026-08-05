"use client";

import { Sliders } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MetricMapNode } from "@/lib/sim/metric-map";
import type { SimUnit } from "@/lib/sim/types";
import { formatValue } from "./sim-dashboard";

/**
 * "How is this number built?"
 *
 * Laid out in columns by depth, so the leaves you can actually move sit on the
 * left and the number you are judged on sits on the right. Reading left to
 * right is reading the arithmetic in order.
 *
 * The rows come from `lib/sim/metric-map.ts`, which derives them from the same
 * driver graph the projection uses — so this cannot drift out of agreement with
 * the maths it is explaining.
 */
export function MetricMap({
  nodes,
  highlight,
  title = "How these numbers connect",
}: {
  nodes: MetricMapNode[];
  /** Usually the north star, so the thing being judged is obvious. */
  highlight?: string;
  title?: string;
}) {
  if (!nodes.length) return null;

  const maxDepth = Math.max(...nodes.map((n) => n.depth));
  const columns = Array.from({ length: maxDepth + 1 }, (_, depth) =>
    nodes.filter((n) => n.depth === depth),
  );

  return (
    <Card className="p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Sliders className="h-3 w-3" /> = something you can change
        </span>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Each column is built from the one before it.{" "}
        {maxDepth > 3 && (
          <span className="font-medium text-foreground">
            Scroll right — the number you&apos;re judged on is at the end of the chain.
          </span>
        )}
      </p>

      {/* Horizontal scroll rather than a squeeze: a chain of five columns is
          unreadable at phone width if it wraps. */}
      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-max gap-3">
          {columns.map((column, depth) => (
            <div key={depth} className="flex w-44 shrink-0 flex-col gap-2">
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {depth === 0 ? "Starting numbers" : `Step ${depth}`}
              </div>
              {column.map((node) => (
                <MetricNode key={node.id} node={node} highlighted={node.id === highlight} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function MetricNode({ node, highlighted }: { node: MetricMapNode; highlighted: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border p-2.5",
        highlighted ? "border-primary bg-primary/10" : "bg-muted/30",
        node.isConstant && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="text-xs font-medium leading-tight">{node.label}</span>
        {node.isLever && (
          <Sliders className="mt-0.5 h-3 w-3 shrink-0 text-primary" aria-label="You can change this" />
        )}
      </div>
      <div className="mt-1 text-sm font-semibold tabular-nums">
        {formatValue(node.value, node.unit as SimUnit)}
      </div>
      {node.formula && (
        <div className="mt-1 font-mono text-[10px] leading-tight text-muted-foreground">
          {node.formula}
        </div>
      )}
      {highlighted && (
        <Badge variant="secondary" className="mt-1.5">
          scored on this
        </Badge>
      )}
    </div>
  );
}

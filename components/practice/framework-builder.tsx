"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ArrowDown, ArrowRight, GripVertical, Plus, Trash2 } from "lucide-react";
import { saveFramework } from "@/app/actions/practice";
import { evaluateExpression } from "@/lib/calc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatIndianNumber, toIndianWords } from "@/lib/utils";
import type { UiFrameworkNode } from "./types";

/**
 * A node's value is a chain factor, not just a label — "40%" and "1.5cr" both
 * parse. A trailing "%" is treated specially since evaluateExpression (shared
 * with the calculator tool) doesn't support it.
 */
/** formatIndianNumber rounds to an integer, which turns fractions like a 0.4
 * (from "40%") into a misleading "0" — show small magnitudes with decimals. */
function formatChainValue(n: number): string {
  if (Math.abs(n) < 1) return n.toFixed(3).replace(/\.?0+$/, "") || "0";
  return formatIndianNumber(n);
}

function parseNodeValue(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const percentMatch = trimmed.match(/^(.+?)\s*%$/);
  if (percentMatch) {
    const n = evaluateExpression(percentMatch[1]);
    return n === null ? null : n / 100;
  }
  return evaluateExpression(trimmed);
}

const PALETTE = [
  "Population",
  "Segmentation",
  "Target Users",
  "Frequency",
  "Quantity",
  "Revenue",
  "Final Estimate",
];

export function FrameworkBuilder({
  attemptId,
  nodes,
  onChange,
  onChainResult,
}: {
  attemptId: string;
  nodes: UiFrameworkNode[];
  onChange: (nodes: UiFrameworkNode[]) => void;
  onChainResult?: (n: number) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [customLabel, setCustomLabel] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dragIndexRef = useRef<number | null>(null);

  // Debounced persistence whenever nodes change.
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveFramework(
        attemptId,
        nodes.map((n) => ({ label: n.label, value: n.value ?? undefined })),
      ).catch(() => {});
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  function add(label: string) {
    onChange([...nodes, { label, value: "" }]);
  }
  function addCustom() {
    const label = customLabel.trim();
    if (!label) return;
    add(label);
    setCustomLabel("");
  }
  function remove(i: number) {
    onChange(nodes.filter((_, idx) => idx !== i));
  }
  function setValue(i: number, value: string) {
    onChange(nodes.map((n, idx) => (idx === i ? { ...n, value } : n)));
  }
  function reorder(from: number, to: number) {
    if (from === to) return;
    const next = [...nodes];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  // Pointer Events (not native HTML5 drag-and-drop) so reordering works with
  // both mouse and touch input — HTML5 `draggable` never fires on touch devices.
  function handleGripPointerDown(e: ReactPointerEvent<HTMLElement>, i: number) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragIndexRef.current = i;
    setDragIndex(i);
  }

  function handleGripPointerMove(e: ReactPointerEvent<HTMLElement>) {
    const from = dragIndexRef.current;
    if (from === null) return;
    const y = e.clientY;
    const overIndex = rowRefs.current.findIndex((el) => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return y >= rect.top && y <= rect.bottom;
    });
    if (overIndex !== -1 && overIndex !== from) {
      reorder(from, overIndex);
      dragIndexRef.current = overIndex;
      setDragIndex(overIndex);
    }
  }

  function handleGripPointerUp(e: ReactPointerEvent<HTMLElement>) {
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragIndexRef.current = null;
    setDragIndex(null);
  }

  const parsedValues = nodes.map((n) => parseNodeValue(n.value));
  const allParsed = nodes.length > 0 && parsedValues.every((v) => v !== null);
  const chainResult = allParsed
    ? parsedValues.reduce<number>((acc, v) => acc * (v as number), 1)
    : null;
  const missingCount = parsedValues.filter((v) => v === null).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {PALETTE.map((p) => (
          <button
            key={p}
            onClick={() => add(p)}
            className="rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary"
          >
            <Plus className="mr-1 inline h-3 w-3" />
            {p}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <Input
          value={customLabel}
          onChange={(e) => setCustomLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCustom()}
          placeholder="Custom step (e.g. Conversion Rate)"
          className="h-7 flex-1 text-xs"
        />
        <Button
          variant="secondary"
          onClick={addCustom}
          className="h-7 shrink-0 px-2.5 text-xs"
        >
          <Plus className="mr-1 h-3 w-3" /> Add
        </Button>
      </div>

      {nodes.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
          Build your estimation chain — add steps above and drag to reorder. Structure is graded.
        </p>
      ) : (
        <div className="space-y-1">
          {nodes.map((n, i) => (
            <div key={i}>
              <div
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border bg-card p-2",
                  dragIndex === i && "opacity-50",
                )}
              >
                <span
                  onPointerDown={(e) => handleGripPointerDown(e, i)}
                  onPointerMove={handleGripPointerMove}
                  onPointerUp={handleGripPointerUp}
                  onPointerCancel={handleGripPointerUp}
                  style={{ touchAction: "none" }}
                  className="shrink-0 cursor-grab touch-none active:cursor-grabbing"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                </span>
                <span className="min-w-0 shrink-0 truncate text-sm font-medium">{n.label}</span>
                <Input
                  value={n.value ?? ""}
                  onChange={(e) => setValue(i, e.target.value)}
                  placeholder="value / formula (e.g. 1.5cr, 40%)"
                  className="h-7 flex-1 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0"
                />
                {n.value?.trim() && (
                  <span
                    className={cn(
                      "shrink-0 font-mono text-[11px]",
                      parsedValues[i] === null ? "text-muted-foreground/60" : "text-muted-foreground",
                    )}
                    title={parsedValues[i] === null ? "Not a recognized number/%" : "Parsed value"}
                  >
                    {parsedValues[i] === null ? "·" : formatChainValue(parsedValues[i] as number)}
                  </span>
                )}
                <button
                  onClick={() => remove(i)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remove step"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {i < nodes.length - 1 && (
                <div className="flex justify-center py-0.5 text-muted-foreground">
                  <ArrowDown className="h-3 w-3" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {nodes.length > 0 && (
        <div className="rounded-lg border bg-muted/30 p-2.5 text-xs">
          {chainResult !== null ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground">
                Chain result:{" "}
                <span className="font-mono font-medium text-foreground">
                  {formatIndianNumber(chainResult)}
                </span>{" "}
                · {toIndianWords(chainResult)}
              </span>
              {onChainResult && (
                <Button
                  variant="secondary"
                  onClick={() => onChainResult(chainResult)}
                  className="h-6 gap-1 px-2 text-[11px]"
                >
                  Use as final estimate <ArrowRight className="h-3 w-3" />
                </Button>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">
              {missingCount} of {nodes.length} step{nodes.length === 1 ? "" : "s"} need a numeric or
              % value (e.g. <span className="font-mono">1.5cr</span>,{" "}
              <span className="font-mono">40%</span>) to compute the chain.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

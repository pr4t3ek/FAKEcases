"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ArrowRight, GripVertical, Plus, Trash2 } from "lucide-react";
import { saveFramework } from "@/app/actions/practice";
import { evaluateExpression } from "@/lib/calc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatIndianNumber, toIndianWords } from "@/lib/utils";
import type { UiFrameworkNode } from "./types";

/**
 * A node's value is a chain factor, not just a label — "40%" and "1.5cr" both
 * parse. A trailing "%" is treated specially since evaluateExpression (shared
 * with the calculator tool) doesn't support it. A blank/unparseable value is
 * treated as a neutral ×1 pass-through, so grouping nodes (e.g. "Segment by
 * Income" — which has no value of its own, only its children do) don't break
 * the chain.
 */
function parseNode(
  raw: string | null | undefined,
): { factor: number; isPercent: boolean } | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // The whole value is a percentage — "40%", or an expression of one ("100/3 %").
  const wholePercent = trimmed.match(/^(.+?)\s*%$/);
  if (wholePercent) {
    const n = evaluateExpression(wholePercent[1]);
    if (n !== null) {
      // Only a bare percentage is a SHARE of its parent, and so a term in a
      // partition. "3 * 50%" is a share times a rate (3 cups × half the
      // segment) — a valid factor, but not something that should total 100%
      // against its siblings.
      return { factor: n / 100, isPercent: !wholePercent[1].includes("*") };
    }
  }

  // A percentage embedded mid-expression — "50% * 3" for "half of them, 3 each".
  // evaluateExpression has no "%" operator, so fold each one into a division.
  const inlined = trimmed.replace(/(\d*\.?\d+)\s*%/g, "($1/100)");
  const n = evaluateExpression(inlined);
  return n === null ? null : { factor: n, isPercent: false };
}

function parseNodeValue(raw: string | null | undefined): number | null {
  return parseNode(raw)?.factor ?? null;
}

/**
 * Percentage branches combined with Σ Sum are a partition of their parent, so
 * they should total ~100% — a gap means a missing segment, an overshoot means
 * double-counting. Rates and prices (×52 weeks, ×₹350) are not shares, so the
 * check only runs when EVERY branch is a percentage. Tolerance absorbs the
 * rounding guesstimates invite (33+33+33 = 99 is fine).
 */
const SHARE_TOTAL_TOLERANCE = 2;

function shareTotalFor(children: UiFrameworkNode[]): number | null {
  if (children.length < 2) return null;
  const parsed = children.map((c) => parseNode(c.value));
  if (!parsed.every((p): p is { factor: number; isPercent: boolean } => !!p?.isPercent)) {
    return null;
  }
  return parsed.reduce((sum, p) => sum + p.factor * 100, 0);
}

/** formatIndianNumber rounds to an integer, which turns fractions like 0.4
 * (from "40%") into a misleading "0" — show small magnitudes with decimals. */
function formatChainValue(n: number): string {
  if (Math.abs(n) < 1) return n.toFixed(3).replace(/\.?0+$/, "") || "0";
  return formatIndianNumber(n);
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `n-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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
  const [dragId, setDragId] = useState<string | null>(null);
  const [customLabel, setCustomLabel] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const dragIdRef = useRef<string | null>(null);

  // Debounced persistence whenever the tree changes.
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveFramework(
        attemptId,
        nodes.map((n) => ({
          id: n.id,
          parentId: n.parentId,
          label: n.label,
          value: n.value ?? undefined,
          combine: n.combine,
        })),
      ).catch(() => {});
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  function add(parentId: string | null, label: string) {
    onChange([...nodes, { id: newId(), parentId, label, value: "", combine: "sum" }]);
  }
  function addCustom() {
    const label = customLabel.trim();
    if (!label) return;
    add(null, label);
    setCustomLabel("");
  }
  function addChild(parentId: string) {
    add(parentId, "New step");
  }
  function collectDescendantIds(id: string): string[] {
    const direct = nodes.filter((n) => n.parentId === id).map((n) => n.id);
    return direct.concat(direct.flatMap((cid) => collectDescendantIds(cid)));
  }
  function remove(id: string) {
    const toRemove = new Set([id, ...collectDescendantIds(id)]);
    onChange(nodes.filter((n) => !toRemove.has(n.id)));
  }
  function setLabel(id: string, label: string) {
    onChange(nodes.map((n) => (n.id === id ? { ...n, label } : n)));
  }
  function setValue(id: string, value: string) {
    onChange(nodes.map((n) => (n.id === id ? { ...n, value } : n)));
  }
  function setCombine(id: string, combine: "sum" | "multiply") {
    onChange(nodes.map((n) => (n.id === id ? { ...n, combine } : n)));
  }
  function reorderSibling(parentId: string | null, fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    const siblingIds = nodes.filter((n) => n.parentId === parentId).map((n) => n.id);
    const reordered = [...siblingIds];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    const siblingNodesById = new Map(nodes.filter((n) => n.parentId === parentId).map((n) => [n.id, n]));
    let cursor = 0;
    const next = nodes.map((n) => {
      if (n.parentId !== parentId) return n;
      const idAtSlot = reordered[cursor++];
      return siblingNodesById.get(idAtSlot)!;
    });
    onChange(next);
  }

  // Pointer Events (not native HTML5 drag-and-drop) so reordering works with
  // both mouse and touch input — HTML5 `draggable` never fires on touch
  // devices. Reordering is scoped to siblings (same parent); re-parenting via
  // drag isn't supported — use the per-row "+" to branch instead.
  function handleGripPointerDown(e: ReactPointerEvent<HTMLElement>, id: string) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragIdRef.current = id;
    setDragId(id);
  }

  function handleGripPointerMove(e: ReactPointerEvent<HTMLElement>) {
    const draggedId = dragIdRef.current;
    if (!draggedId) return;
    const draggedNode = nodes.find((n) => n.id === draggedId);
    if (!draggedNode) return;
    const siblings = nodes.filter((n) => n.parentId === draggedNode.parentId);
    const y = e.clientY;
    const overNode = siblings.find((s) => {
      const el = rowRefs.current.get(s.id);
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return y >= rect.top && y <= rect.bottom;
    });
    if (overNode && overNode.id !== draggedId) {
      const fromIdx = siblings.findIndex((s) => s.id === draggedId);
      const toIdx = siblings.findIndex((s) => s.id === overNode.id);
      reorderSibling(draggedNode.parentId, fromIdx, toIdx);
    }
  }

  function handleGripPointerUp(e: ReactPointerEvent<HTMLElement>) {
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragIdRef.current = null;
    setDragId(null);
  }

  // Two distinct quantities per node, deliberately kept apart:
  //   resolved — the step's OWN value in the chain: inherited from its parent ×
  //     its own parsed value. This is what the row displays, so a top-level
  //     step shows exactly what was typed and a "30%" child shows 30% OF its
  //     parent. It does not move when children are added or edited.
  //   rollup — what the step contributes UPWARD: a leaf contributes its
  //     resolved value; a parent combines its branches via Sum or Multiply
  //     (its own manual toggle). Only this feeds the Chain result below.
  const byParent = new Map<string | null, UiFrameworkNode[]>();
  for (const n of nodes) {
    const arr = byParent.get(n.parentId) ?? [];
    arr.push(n);
    byParent.set(n.parentId, arr);
  }
  const resolvedMap = new Map<string, number>();
  const rollupMap = new Map<string, number>();
  // A step's value is only meaningful once something real feeds into it — its
  // own entry or an ancestor's. Without this, a node's neutral ×1 pass-through
  // (see parseNodeValue) would render as a literal "1".
  const liveMap = new Map<string, boolean>();
  function visit(node: UiFrameworkNode, inherited: number, inheritedLive: boolean): number {
    const own = parseNodeValue(node.value) ?? 1;
    const resolved = inherited * own;
    const live = inheritedLive || !!node.value?.trim();
    resolvedMap.set(node.id, resolved);
    liveMap.set(node.id, live);
    const children = byParent.get(node.id) ?? [];
    if (children.length === 0) {
      rollupMap.set(node.id, resolved);
      return resolved;
    }
    const childRollups = children.map((c) => visit(c, resolved, live));
    const total =
      node.combine === "multiply"
        ? childRollups.reduce((a, b) => a * b, 1)
        : childRollups.reduce((a, b) => a + b, 0);
    rollupMap.set(node.id, total);
    return total;
  }
  const roots = byParent.get(null) ?? [];
  for (const r of roots) visit(r, 1, false);
  const anyParsed = nodes.some((n) => parseNodeValue(n.value) !== null);
  const grandTotal = anyParsed ? roots.reduce((sum, r) => sum + (rollupMap.get(r.id) ?? 0), 0) : null;
  const unrecognizedCount = nodes.filter(
    (n) => n.value?.trim() && parseNodeValue(n.value) === null,
  ).length;

  function renderNode(node: UiFrameworkNode) {
    const children = byParent.get(node.id) ?? [];
    const resolved = resolvedMap.get(node.id) ?? 0;
    const ownUnrecognized = !!node.value?.trim() && parseNodeValue(node.value) === null;
    const showValue = liveMap.get(node.id) ?? false;
    const shareTotal = node.combine === "sum" ? shareTotalFor(children) : null;
    const shareOff =
      shareTotal !== null && Math.abs(shareTotal - 100) > SHARE_TOTAL_TOLERANCE;

    return (
      <div key={node.id} className="space-y-1">
        <div
          ref={(el) => {
            if (el) rowRefs.current.set(node.id, el);
            else rowRefs.current.delete(node.id);
          }}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border bg-card p-2",
            dragId === node.id && "opacity-50",
          )}
        >
          <span
            onPointerDown={(e) => handleGripPointerDown(e, node.id)}
            onPointerMove={handleGripPointerMove}
            onPointerUp={handleGripPointerUp}
            onPointerCancel={handleGripPointerUp}
            style={{ touchAction: "none" }}
            className="shrink-0 cursor-grab touch-none active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </span>
          <Input
            value={node.label}
            onChange={(e) => setLabel(node.id, e.target.value)}
            placeholder="Step name"
            className="h-7 w-24 shrink-0 border-0 bg-transparent px-1 text-sm font-medium shadow-none focus-visible:ring-0"
          />
          <Input
            value={node.value ?? ""}
            onChange={(e) => setValue(node.id, e.target.value)}
            placeholder="value / % (optional)"
            className="h-7 flex-1 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0"
          />
          <span
            className={cn(
              "shrink-0 font-mono text-[11px]",
              ownUnrecognized ? "text-amber-600" : "text-muted-foreground",
            )}
            title={
              ownUnrecognized
                ? "Not a recognized number/% — treated as ×1"
                : showValue
                  ? "This step's own value — its share of its parent"
                  : "No value entered in this branch yet"
            }
          >
            {showValue ? formatChainValue(resolved) : "–"}
            {ownUnrecognized && "!"}
          </span>
          <button
            onClick={() => addChild(node.id)}
            className="shrink-0 text-muted-foreground hover:text-primary"
            aria-label="Add branch under this step"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => remove(node.id)}
            className="shrink-0 text-muted-foreground hover:text-destructive"
            aria-label="Remove step"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {children.length >= 2 && (
          <div className="ml-7 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
            <span>Combine {children.length} branches:</span>
            <button
              onClick={() => setCombine(node.id, "sum")}
              className={cn(
                "rounded px-1.5 py-0.5",
                node.combine === "sum" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              Σ Sum
            </button>
            <button
              onClick={() => setCombine(node.id, "multiply")}
              className={cn(
                "rounded px-1.5 py-0.5",
                node.combine === "multiply"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
            >
              × Multiply
            </button>
            {shareTotal !== null && (
              <span
                className={cn("font-mono", shareOff ? "text-amber-600" : "text-emerald-600")}
                title={
                  shareOff
                    ? "These branches are percentage shares of this step, so they should total about 100% — a gap suggests a missing segment, an overshoot suggests double-counting."
                    : "Shares total ~100% — a clean partition of this step."
                }
              >
                {shareOff ? "⚠ " : "✓ "}
                shares total {Math.round(shareTotal * 10) / 10}%
              </span>
            )}
          </div>
        )}

        {children.length > 0 && (
          <div className="ml-3.5 space-y-1 border-l border-dashed pl-3">
            {children.map((c) => renderNode(c))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {PALETTE.map((p) => (
          <button
            key={p}
            onClick={() => add(null, p)}
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
        <Button variant="secondary" onClick={addCustom} className="h-7 shrink-0 px-2.5 text-xs">
          <Plus className="mr-1 h-3 w-3" /> Add
        </Button>
      </div>

      {roots.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
          Build your estimation tree — add a starting step above, then use the row's{" "}
          <Plus className="inline h-3 w-3 align-text-bottom" /> to branch into segments. Structure
          is graded.
        </p>
      ) : (
        <div className="space-y-1">{roots.map((r) => renderNode(r))}</div>
      )}

      {roots.length > 0 && (
        <div className="rounded-lg border bg-muted/30 p-2.5 text-xs">
          {grandTotal !== null ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground">
                Chain result:{" "}
                <span className="font-mono font-medium text-foreground">
                  {formatIndianNumber(grandTotal)}
                </span>{" "}
                · {toIndianWords(grandTotal)}
                {unrecognizedCount > 0 && (
                  <span className="ml-1 text-amber-600">
                    ({unrecognizedCount} step{unrecognizedCount === 1 ? "" : "s"} not recognized,
                    treated as ×1)
                  </span>
                )}
              </span>
              {onChainResult && (
                <Button
                  variant="secondary"
                  onClick={() => onChainResult(grandTotal)}
                  className="h-6 gap-1 px-2 text-[11px]"
                >
                  Use as final estimate <ArrowRight className="h-3 w-3" />
                </Button>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">
              Add a numeric or % value (e.g. <span className="font-mono">1.5cr</span>,{" "}
              <span className="font-mono">40%</span>) to any step to compute a result. Steps with
              no value (like a segmentation grouping) pass their parent's value straight through.
              To segment by usage intensity, give a branch its share and rate together —{" "}
              <span className="font-mono">30%×4</span> for &ldquo;a third of them, 4 a
              day&rdquo;.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

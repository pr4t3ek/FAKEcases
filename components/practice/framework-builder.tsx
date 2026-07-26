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

  // Bottom-up: each node's computed value = (inherited from parent × its own
  // parsed value), then a node with children combines their computed values
  // via Sum or Multiply (its own manual toggle) to produce ITS computed value.
  const byParent = new Map<string | null, UiFrameworkNode[]>();
  for (const n of nodes) {
    const arr = byParent.get(n.parentId) ?? [];
    arr.push(n);
    byParent.set(n.parentId, arr);
  }
  const computedMap = new Map<string, number>();
  function visit(node: UiFrameworkNode, inherited: number): number {
    const own = parseNodeValue(node.value) ?? 1;
    const mine = inherited * own;
    const children = byParent.get(node.id) ?? [];
    if (children.length === 0) {
      computedMap.set(node.id, mine);
      return mine;
    }
    const childResults = children.map((c) => visit(c, mine));
    const total =
      node.combine === "multiply"
        ? childResults.reduce((a, b) => a * b, 1)
        : childResults.reduce((a, b) => a + b, 0);
    computedMap.set(node.id, total);
    return total;
  }
  const roots = byParent.get(null) ?? [];
  for (const r of roots) visit(r, 1);
  const anyParsed = nodes.some((n) => parseNodeValue(n.value) !== null);
  const grandTotal = anyParsed ? roots.reduce((sum, r) => sum + (computedMap.get(r.id) ?? 0), 0) : null;
  const unrecognizedCount = nodes.filter(
    (n) => n.value?.trim() && parseNodeValue(n.value) === null,
  ).length;

  function renderNode(node: UiFrameworkNode) {
    const children = byParent.get(node.id) ?? [];
    const computed = computedMap.get(node.id) ?? 0;
    const ownUnrecognized = !!node.value?.trim() && parseNodeValue(node.value) === null;

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
                : "Running value at this step"
            }
          >
            {formatChainValue(computed)}
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
          <div className="ml-7 flex items-center gap-1 text-[11px] text-muted-foreground">
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
            </p>
          )}
        </div>
      )}
    </div>
  );
}

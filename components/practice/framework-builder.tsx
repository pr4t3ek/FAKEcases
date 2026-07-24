"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, GripVertical, Plus, Trash2 } from "lucide-react";
import { saveFramework } from "@/app/actions/practice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { UiFrameworkNode } from "./types";

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
}: {
  attemptId: string;
  nodes: UiFrameworkNode[];
  onChange: (nodes: UiFrameworkNode[]) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

      {nodes.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
          Build your estimation chain — add steps above and drag to reorder. Structure is graded.
        </p>
      ) : (
        <div className="space-y-1">
          {nodes.map((n, i) => (
            <div key={i}>
              <div
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null) reorder(dragIndex, i);
                  setDragIndex(null);
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border bg-card p-2",
                  dragIndex === i && "opacity-50",
                )}
              >
                <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" />
                <span className="min-w-0 shrink-0 truncate text-sm font-medium">{n.label}</span>
                <Input
                  value={n.value ?? ""}
                  onChange={(e) => setValue(i, e.target.value)}
                  placeholder="value / formula"
                  className="h-7 flex-1 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0"
                />
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
    </div>
  );
}

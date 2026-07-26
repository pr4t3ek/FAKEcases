"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Calculator as CalcIcon, GripHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calculator } from "./calculator";
import type { UiCalculation } from "./types";

const PANEL_WIDTH = 320;
/** Keep at least this much of the panel on screen so it can always be grabbed. */
const EDGE_KEEP = 48;

function clampToViewport(x: number, y: number, el: HTMLElement | null) {
  const w = el?.offsetWidth ?? PANEL_WIDTH;
  const h = el?.offsetHeight ?? 0;
  const maxX = Math.max(0, window.innerWidth - w);
  const maxY = Math.max(0, window.innerHeight - Math.min(h, EDGE_KEEP * 2));
  return {
    x: Math.min(Math.max(x, 0), maxX),
    y: Math.min(Math.max(y, 0), maxY),
  };
}

/**
 * The calculator as a floating, draggable panel rather than a tool tab, so it
 * stays available while the framework builder or notes are on screen. It still
 * saves to the attempt (see Calculator), so working remains visible in the
 * progress panel and countable by the evaluator.
 */
export function CalculatorPopup({
  attemptId,
  calculations,
  onAdd,
}: {
  attemptId: string;
  calculations: UiCalculation[];
  onAdd: (c: UiCalculation) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const grabOffset = useRef<{ dx: number; dy: number } | null>(null);

  // First open: sit near the bottom-left, clear of the chat composer.
  useLayoutEffect(() => {
    if (!open || pos) return;
    const el = panelRef.current;
    const h = el?.offsetHeight ?? 260;
    setPos(clampToViewport(24, Math.max(24, window.innerHeight - h - 96), el));
  }, [open, pos]);

  // A window resize can leave the panel stranded off-screen.
  useEffect(() => {
    if (!open) return;
    function onResize() {
      setPos((p) => (p ? clampToViewport(p.x, p.y, panelRef.current) : p));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    grabOffset.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    setDragging(true);
  }, []);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const grab = grabOffset.current;
    if (!grab) return;
    setPos(clampToViewport(e.clientX - grab.dx, e.clientY - grab.dy, panelRef.current));
  }, []);

  const onPointerUp = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    grabOffset.current = null;
    setDragging(false);
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1 text-xs hover:text-foreground",
          open ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <CalcIcon className="h-3 w-3" /> Calculator
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Calculator"
            style={{
              left: pos?.x ?? -9999,
              top: pos?.y ?? -9999,
              width: PANEL_WIDTH,
              visibility: pos ? "visible" : "hidden",
            }}
            className={cn(
              "fixed z-50 max-w-[calc(100vw-1rem)] rounded-xl border bg-card shadow-xl",
              dragging && "select-none",
            )}
          >
            <div
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              style={{ touchAction: "none" }}
              className={cn(
                "flex items-center gap-1.5 rounded-t-xl border-b bg-muted/40 px-3 py-2",
                dragging ? "cursor-grabbing" : "cursor-grab",
              )}
            >
              <GripHorizontal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 text-xs font-medium">Calculator</span>
              <button
                onClick={() => setOpen(false)}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label="Close calculator"
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-3">
              <Calculator attemptId={attemptId} calculations={calculations} onAdd={onAdd} />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

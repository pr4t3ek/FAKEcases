"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ChevronDown, ChevronUp, GripHorizontal, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The interviewer as a draggable window, for fullscreen.
 *
 * Carries `data-canvas-overlay`, which the canvas's pan handler checks before
 * capturing the pointer. Without it, pressing anything in here would start a
 * canvas pan and the captured pointer would swallow the click outright — the
 * exact failure that silently broke the zoom buttons.
 */

const WIDTH = 380;
const MARGIN = 12;
/** Enough of the title bar left on screen to grab it back. */
const MIN_VISIBLE = 80;

export function FloatingChat({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const dragFrom = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  // Opens on the right, where the chat panel sits in the normal layout, so
  // fullscreen doesn't move the conversation somewhere new.
  useEffect(() => {
    if (pos) return;
    setPos({ x: Math.max(MARGIN, window.innerWidth - WIDTH - MARGIN * 2), y: 72 });
  }, [pos]);

  function clamp(x: number, y: number) {
    return {
      x: Math.min(Math.max(x, MARGIN - WIDTH + MIN_VISIBLE), window.innerWidth - MIN_VISIBLE),
      y: Math.min(Math.max(y, MARGIN), window.innerHeight - MIN_VISIBLE),
    };
  }

  // A window dragged mostly off-screen, or left beyond a shrunken viewport, is
  // unreachable — so the clamp is re-applied when the window resizes too.
  useEffect(() => {
    function onResize() {
      setPos((p) => (p ? clamp(p.x, p.y) : p));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!pos) return;
    // The collapse button lives in this bar. Capturing the pointer on top of it
    // would send the `pointerup` here instead, and the browser would then fire
    // no click on the button at all — the same way the canvas's pan handler
    // silently swallowed the zoom controls.
    if ((e.target as HTMLElement).closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragFrom.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const from = dragFrom.current;
    if (!from) return;
    setPos(clamp(from.px + (e.clientX - from.x), from.py + (e.clientY - from.y)));
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (dragFrom.current) e.currentTarget.releasePointerCapture(e.pointerId);
    dragFrom.current = null;
  }

  if (!pos) return null;

  return (
    <div
      data-canvas-overlay
      style={{ left: pos.x, top: pos.y, width: WIDTH }}
      className="fixed z-50 flex flex-col overflow-hidden rounded-xl border bg-card shadow-2xl"
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ touchAction: "none" }}
        className="flex shrink-0 cursor-grab items-center gap-2 border-b bg-muted/40 px-3 py-2 active:cursor-grabbing"
      >
        <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="flex-1 truncate text-xs font-medium">{title}</span>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-muted-foreground hover:text-foreground"
          aria-label={collapsed ? "Expand the interviewer" : "Collapse the interviewer"}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Hidden, not unmounted: unmounting would drop the chat's own input and
          streaming state, so collapsing mid-reply would lose the reply. */}
      <div className={cn("h-[26rem]", collapsed && "hidden")}>{children}</div>
    </div>
  );
}

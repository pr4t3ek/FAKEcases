"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Maximize2,
  Minus,
  Plus,
  Scan,
  Search,
  Trash2,
} from "lucide-react";
import { CARD_WIDTH, layoutTree } from "@/lib/framework-layout";
import { rootIndexOf } from "@/lib/framework-tree";
import { branchDiscussed } from "@/lib/diagnosis";
import { NODE_STATUS_META, type NodeStatus } from "@/lib/types";
import type { FrameworkNodeTemplate } from "@/lib/config/frameworks";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  CARD_HEALTHY,
  CARD_STATUS_BORDER,
  EDGE_STROKE,
  STATUS_STYLE,
  familyStyle,
} from "./framework-depth";
import type { UiFrameworkNode } from "./types";

/**
 * The case framework tree, drawn as a top-down flow diagram.
 *
 * This is a re-skin, not a rewrite: every mutation still runs through the
 * builder's own handlers, passed in below. What changes is that a node is a card
 * with connectors drawn to its children, instead of a box that physically
 * contains them. The old containment layout ran out of width by depth three —
 * each level cost an indent, and an issue tree goes deep.
 *
 * Two things the drawing has to keep saying at once, which is why status and
 * family use different channels (see `framework-depth.ts`): which top-level
 * branch a node belongs to (the fill), and what the candidate has decided about
 * it (the border).
 */

/** Card geometry. Base height must match `CARD_HEIGHT` in the layout module. */
const CARD_BASE_HEIGHT = 72;
const LINE_HEIGHT = 17;
const CHIP_ROW_HEIGHT = 24;
const STAGE_PAD = 32;
// Wide enough to be worth having at both ends: far enough out to see a
// twenty-branch tree whole, far enough in to read a card on a laptop screen.
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.5;
/**
 * Divisor on the (pixel-normalised) wheel delta before it becomes a scale
 * factor. Tuned so one mouse notch is about a fifth in or out, while a
 * trackpad's stream of small deltas stays smooth rather than snapping.
 */
const WHEEL_ZOOM_SENSITIVITY = 500;

/**
 * Wheel deltas in pixels, whatever units the browser chose to report.
 *
 * Firefox sends `deltaMode: 1` (lines) with a delta of about 3 where Chrome
 * sends 100 pixels, so using the raw number would make a notch of the same
 * wheel do thirty times less in one browser than the other.
 */
function wheelPixels(e: WheelEvent): { dx: number; dy: number } {
  const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
  return { dx: e.deltaX * scale, dy: e.deltaY * scale };
}

const clampZoom = (k: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k));

export interface FrameworkCanvasProps {
  nodes: UiFrameworkNode[];
  /** Branches whose children are hidden right now. */
  isFolded: (nodeId: string, childCount: number) => boolean;

  // Lookups the builder already computes — passed in rather than recomputed.
  ghostFor: (node: UiFrameworkNode) => string | null;
  offersFor: (node: UiFrameworkNode) => FrameworkNodeTemplate[];
  hintsForNode: (node: UiFrameworkNode) => string[];

  // Mutations. Every one of these is the builder's existing handler.
  setLabel: (id: string, label: string) => void;
  cycleStatus: (id: string) => void;
  /** True when this branch contains a problem, so it can't be cleared. */
  healthyBlocked: (id: string) => boolean;
  addChild: (id: string) => void;
  /** Confirms first when the branch has anything to lose. See the builder. */
  requestRemove: (id: string) => void;
  toggleFold: (id: string) => void;
  acceptOffer: (parentId: string, label: string) => void;
  dismissOffers: (id: string) => void;
  onLabelKeyDown: (
    e: ReactKeyboardEvent<HTMLInputElement>,
    node: UiFrameworkNode,
    ghost?: string | null,
  ) => void;
  onAskAbout?: (label: string) => void;

  registerLabelRef: (id: string, el: HTMLInputElement | null) => void;
  /** Cards register themselves so the sibling drag can hit-test against them. */
  registerRowRef: (id: string, el: HTMLElement | null) => void;
  onFocusNode: (id: string | null) => void;

  /** Sibling drag-reorder — the same feature as the outline, on the X axis. */
  dragId: string | null;
  onGripDown: (e: ReactPointerEvent<HTMLElement>, id: string) => void;
  onGripMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onGripUp: (e: ReactPointerEvent<HTMLElement>) => void;

  hasDataPack: boolean;
  conversation: string[];
  messageText?: Map<string, string>;

  /** Fill the parent instead of taking a fixed height — used by fullscreen. */
  fill?: boolean;
  /** Omitted when there is nowhere to expand to (i.e. already fullscreen). */
  onFullscreen?: () => void;
}

export function FrameworkCanvas(props: FrameworkCanvasProps) {
  const { nodes, isFolded, messageText, conversation, hasDataPack, fill, onFullscreen } = props;

  const viewportRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: STAGE_PAD, y: STAGE_PAD, k: 1 });
  const panFrom = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const didFit = useRef(false);

  const byParent = new Map<string | null, UiFrameworkNode[]>();
  for (const n of nodes) {
    const arr = byParent.get(n.parentId) ?? [];
    arr.push(n);
    byParent.set(n.parentId, arr);
  }
  const childrenOf = (id: string) => byParent.get(id) ?? [];
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const collapsed = new Set(
    nodes.filter((n) => isFolded(n.id, childrenOf(n.id).length)).map((n) => n.id),
  );

  /**
   * The rationale a card shows. Its own first — inherited from a chat turn, or
   * typed — and failing that its parent's, faded, so reasoning reads down a
   * branch instead of being retyped on every child.
   *
   * The inherited line is DISPLAY ONLY and must stay that way. `deriveAssumptions`
   * rates a branch "Excellent" when its rationale came from chat and
   * "NeedsJustification" when it has none; writing a parent's rationale into its
   * children would hand every child a mark nobody earned.
   */
  function rationaleFor(node: UiFrameworkNode): {
    text: string;
    kind: "chat" | "typed" | "parent";
  } | null {
    const own = node.sourceMessageId ? messageText?.get(node.sourceMessageId)?.trim() : "";
    if (own) return { text: own, kind: "chat" };
    const typed = node.note?.trim();
    if (typed) return { text: typed, kind: "typed" };

    const parent = node.parentId ? byId.get(node.parentId) : null;
    if (!parent) return null;
    const fromChat = parent.sourceMessageId
      ? messageText?.get(parent.sourceMessageId)?.trim()
      : "";
    const inherited = fromChat || parent.note?.trim();
    if (!inherited) return null;
    return { text: `${parent.label.trim() || "Parent"}: ${inherited}`, kind: "parent" };
  }

  function isUnevidenced(node: UiFrameworkNode): boolean {
    const status = node.status ?? "unknown";
    return (
      // Never on a tutorial illustration: it is a real warning about the
      // candidate's own work, and firing it on a drawing is just noise.
      !node.id.startsWith("demo:") &&
      hasDataPack &&
      !!node.label.trim() &&
      status !== "unknown" &&
      !branchDiscussed(node.label, conversation)
    );
  }

  /**
   * A card's height, computed from its content rather than measured.
   *
   * Deterministic on purpose: the layout needs heights before anything renders,
   * and measuring the DOM would mean laying out twice. Rounded up generously —
   * an overestimate costs a little whitespace, an underestimate would let a card
   * overlap the row beneath it.
   */
  function cardHeight(node: UiFrameworkNode): number {
    let height = CARD_BASE_HEIGHT;
    if (rationaleFor(node)) height += LINE_HEIGHT;
    if (isUnevidenced(node)) height += LINE_HEIGHT;

    const offers = props.offersFor(node);
    if (offers.length > 0) height += 18 + Math.ceil(offers.length / 2) * CHIP_ROW_HEIGHT;

    const hints = props.hintsForNode(node);
    if (hints.length > 0) height += 16 + Math.ceil(hints.length / 2) * LINE_HEIGHT;

    return height;
  }

  const layout = layoutTree(nodes, { collapsed, heightOf: (id) => {
    const node = byId.get(id);
    return node ? cardHeight(node) : CARD_BASE_HEIGHT;
  } });

  const fit = useCallback(() => {
    const el = viewportRef.current;
    if (!el || layout.width === 0 || layout.height === 0) return;
    const rect = el.getBoundingClientRect();
    const k = clampZoom(
      Math.min(
        (rect.width - STAGE_PAD * 2) / layout.width,
        (rect.height - STAGE_PAD * 2) / layout.height,
        1,
      ),
    );
    setView({ k, x: Math.max(STAGE_PAD, (rect.width - layout.width * k) / 2), y: STAGE_PAD });
  }, [layout.width, layout.height]);

  // Fit once, when there is first something to fit. Re-fitting on every edit
  // would yank the diagram out from under someone who has panned deliberately.
  useEffect(() => {
    if (didFit.current || layout.width === 0) return;
    didFit.current = true;
    fit();
  }, [fit, layout.width]);

  /**
   * Scale about a fixed point in viewport coordinates, so whatever sits under
   * that point stays under it. The buttons pass the viewport centre; the wheel
   * passes the pointer.
   */
  function zoomAbout(factor: number, originX: number, originY: number) {
    setView((v) => {
      const k = clampZoom(v.k * factor);
      if (k === v.k) return v;
      const ratio = k / v.k;
      return { k, x: originX - (originX - v.x) * ratio, y: originY - (originY - v.y) * ratio };
    });
  }

  function zoomBy(factor: number) {
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    zoomAbout(factor, rect.width / 2, rect.height / 2);
  }

  /**
   * Wheel and trackpad, on the convention every canvas tool uses: wheel pans,
   * Shift+wheel pans sideways, Ctrl/⌘+wheel zooms. A trackpad pinch arrives as
   * ctrl+wheel, so pinch-to-zoom comes free with the modifier branch.
   *
   * Bound by hand rather than through React's `onWheel`, and that is the whole
   * reason this is an effect: React attaches wheel listeners **passively** at
   * the root, so `preventDefault()` inside `onWheel` is ignored and the tools
   * panel scrolls the diagram out of view instead of the canvas reacting.
   */
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const { dx, dy } = wheelPixels(e);

      if (e.ctrlKey || e.metaKey) {
        const rect = el!.getBoundingClientRect();
        zoomAbout(
          Math.exp(-dy / WHEEL_ZOOM_SENSITIVITY),
          e.clientX - rect.left,
          e.clientY - rect.top,
        );
        return;
      }

      // Shift makes a vertical wheel scroll sideways, which is what a one-axis
      // mouse needs on a tree that grows wider than it does tall.
      const [panX, panY] = e.shiftKey ? [dy, dx] : [dx, dy];
      setView((v) => ({ ...v, x: v.x - panX, y: v.y - panY }));
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function handlePanDown(e: ReactPointerEvent<HTMLDivElement>) {
    // Anything inside a card belongs to the card — its inputs, its buttons and
    // its drag grip all need the pointer. So do the zoom controls, which sit
    // inside the viewport: capturing the pointer here would swallow their
    // click entirely, because a captured pointer sends its `pointerup` to the
    // capturing element and the browser then fires no click on the button.
    const target = e.target as HTMLElement;
    if (target.closest("[data-node-card]") || target.closest("[data-canvas-overlay]")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    panFrom.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
  }

  function handlePanMove(e: ReactPointerEvent<HTMLDivElement>) {
    const from = panFrom.current;
    if (!from) return;
    setView((v) => ({ ...v, x: from.vx + (e.clientX - from.x), y: from.vy + (e.clientY - from.y) }));
  }

  function handlePanUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (panFrom.current) e.currentTarget.releasePointerCapture(e.pointerId);
    panFrom.current = null;
  }

  return (
    <div className={cn("relative", fill && "flex min-h-0 flex-1 flex-col")}>
      <div
        ref={viewportRef}
        onPointerDown={handlePanDown}
        onPointerMove={handlePanMove}
        onPointerUp={handlePanUp}
        onPointerCancel={handlePanUp}
        className={cn(
          "relative overflow-hidden rounded-xl border bg-muted/20",
          // Capped rather than a bare vh: the answer bar below grows a line
          // whenever the diagnosis trail does, and a taller canvas would push
          // its own zoom controls out of the scrolling panel. Fullscreen has no
          // such neighbour, so there it just fills.
          fill ? "min-h-0 flex-1" : "h-[clamp(20rem,48vh,32rem)]",
          panFrom.current ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: layout.width,
            height: layout.height,
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
          }}
        >
          {/* Connectors sit under the cards and take no pointer events, so a
              click on empty diagram still pans. */}
          <svg
            className="pointer-events-none absolute left-0 top-0 overflow-visible"
            width={Math.max(layout.width, 1)}
            height={Math.max(layout.height, 1)}
            aria-hidden
          >
            {layout.edges.map((edge) => {
              const from = layout.nodes.get(edge.from);
              const to = layout.nodes.get(edge.to);
              const parent = byId.get(edge.from);
              const child = byId.get(edge.to);
              if (!from || !to || !parent || !child) return null;

              const startY = from.y + cardHeight(parent);
              const midY = startY + (to.y - startY) / 2;
              return (
                <path
                  key={`${edge.from}-${edge.to}`}
                  d={`M ${from.x} ${startY} V ${midY} H ${to.x} V ${to.y}`}
                  fill="none"
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                  stroke={EDGE_STROKE[(child.status ?? "unknown") as NodeStatus]}
                />
              );
            })}
          </svg>

          {nodes.map((node) => {
            const position = layout.nodes.get(node.id);
            if (!position) return null;
            return (
              <NodeCard
                key={node.id}
                node={node}
                left={position.x - CARD_WIDTH / 2}
                top={position.y}
                depth={position.depth}
                rootIndex={rootIndexOf(nodes, node.id)}
                childCount={childrenOf(node.id).length}
                folded={collapsed.has(node.id)}
                rationale={rationaleFor(node)}
                unevidenced={isUnevidenced(node)}
                {...props}
              />
            );
          })}
        </div>

        {/* Viewport controls. Absolute, so they don't ride the transform, and
            flagged so the pan handler leaves their pointer events alone. */}
        <div
          data-canvas-overlay
          data-tour="canvas-controls"
          className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg border bg-card/90 p-1 shadow-sm backdrop-blur"
        >
          <button
            onClick={() => zoomBy(1 / 1.2)}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Zoom out"
            title="Zoom out"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-9 text-center font-mono text-[10px] tabular-nums text-muted-foreground">
            {Math.round(view.k * 100)}%
          </span>
          <button
            onClick={() => zoomBy(1.2)}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Zoom in"
            title="Zoom in"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={fit}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Fit tree to view"
            title="Fit to view"
          >
            <Scan className="h-3.5 w-3.5" />
          </button>
          {onFullscreen && (
            <button
              onClick={onFullscreen}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Open the tree fullscreen"
              title="Fullscreen — the interviewer moves to a floating window"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Drag the background to pan. A branch&apos;s{" "}
        <Plus className="inline h-3 w-3 align-text-bottom" /> adds a child under it;{" "}
        <span className="font-mono">Enter</span> adds a sibling and{" "}
        <span className="font-mono">Tab</span> nests it. Mark each branch as you rule it out or
        drill into it.
      </p>
    </div>
  );
}

interface NodeCardProps extends FrameworkCanvasProps {
  node: UiFrameworkNode;
  left: number;
  top: number;
  depth: number;
  rootIndex: number;
  childCount: number;
  folded: boolean;
  rationale: { text: string; kind: "chat" | "typed" | "parent" } | null;
  unevidenced: boolean;
}

function NodeCard({
  node,
  left,
  top,
  depth,
  rootIndex,
  childCount,
  folded,
  rationale,
  unevidenced,
  ...api
}: NodeCardProps) {
  const status = (node.status ?? "unknown") as NodeStatus;
  const meta = NODE_STATUS_META[status];
  const tint = familyStyle(rootIndex, depth);
  // A tutorial illustration, not the candidate's work. It is never in `nodes`,
  // so its controls would be inert anyway — better to say so than to offer
  // buttons that quietly do nothing.
  const isDemo = node.id.startsWith("demo:");
  const ghost = isDemo ? null : api.ghostFor(node);
  const offers = isDemo ? [] : api.offersFor(node);
  const hints = isDemo ? [] : api.hintsForNode(node);

  return (
    <div
      data-node-card
      ref={(el) => api.registerRowRef(node.id, el)}
      style={{ left, top, width: CARD_WIDTH }}
      className={cn(
        // Fill carries the family, border carries the verdict — except on a
        // cleared branch, which drops the family tint entirely and recedes.
        // Applied instead of the tint rather than over it, so there is no
        // specificity fight and no colour left underneath.
        "group/card absolute rounded-xl border-2 p-2 shadow-sm transition-colors",
        status === "healthy" ? CARD_HEALTHY : cn(tint.box, CARD_STATUS_BORDER[status]),
        isDemo && "border-dashed",
        api.dragId === node.id && "opacity-50",
      )}
    >
      {isDemo && (
        <span className="pointer-events-none absolute -top-2 left-2 rounded-full border border-dashed bg-background px-1.5 text-[9px] uppercase tracking-wide text-muted-foreground">
          example
        </span>
      )}
      <div className="flex items-start gap-1">
        <span
          onPointerDown={(e) => api.onGripDown(e, node.id)}
          onPointerMove={api.onGripMove}
          onPointerUp={api.onGripUp}
          onPointerCancel={api.onGripUp}
          style={{ touchAction: "none" }}
          className="mt-1 shrink-0 cursor-grab touch-none active:cursor-grabbing"
          aria-label="Reorder among siblings"
        >
          <GripVertical
            className={cn(
              "h-3.5 w-3.5",
              status === "healthy" ? "text-muted-foreground/50" : tint.grip,
            )}
          />
        </span>

        <div className="relative min-w-0 flex-1">
          {ghost && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 flex items-center truncate px-1 text-sm font-medium"
            >
              <span className="invisible">{node.label}</span>
              <span className="text-muted-foreground/40">{ghost.slice(node.label.length)}</span>
            </span>
          )}
          <Input
            ref={(el) => api.registerLabelRef(node.id, el)}
            value={node.label}
            onChange={(e) => api.setLabel(node.id, e.target.value)}
            onKeyDown={(e) => api.onLabelKeyDown(e, node, ghost)}
            onFocus={() => api.onFocusNode(node.id)}
            onBlur={() => api.onFocusNode(null)}
            placeholder="Name this branch"
            className="relative h-6 border-0 bg-transparent px-1 text-sm font-medium shadow-none focus-visible:ring-0"
          />
        </div>

        <button
          onClick={() => api.cycleStatus(node.id)}
          title={
            api.healthyBlocked(node.id)
              ? `${meta.label} — ${meta.hint}. Can't be cleared: a branch inside it is marked as the problem.`
              : `${meta.label} — ${meta.hint}. Click to change.`
          }
          aria-label={`Status: ${meta.label}`}
          className={cn(
            "mt-0.5 h-5 shrink-0 rounded border px-1.5 font-mono text-[10px] font-semibold transition-colors",
            STATUS_STYLE[status],
          )}
        >
          {meta.short}
        </button>
      </div>

      {unevidenced && (
        <p
          className="flex items-start gap-1 px-1 pt-0.5 text-[11px] leading-snug text-warning"
          title="You've judged this branch without raising it with the interviewer. You may well be right — but an interviewer will ask what you checked."
        >
          <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
          marked without asking
        </p>
      )}

      {/* Read-only. A branch earns its reasoning by being talked through in the
          chat, not by being annotated in a box — which is also the rationale the
          scorer rates highest. Anything typed before is still shown. */}
      {rationale && (
        <p
          className={cn(
            "truncate px-1 pt-0.5 text-[11px] leading-snug",
            // A parent's reasoning is context, not this branch's own work, so it
            // is quieter than a rationale the candidate gave this branch.
            rationale.kind === "parent"
              ? "italic text-muted-foreground/60"
              : "text-muted-foreground",
          )}
          title={rationale.text}
        >
          <span
            className={cn(
              "mr-1 font-mono",
              rationale.kind === "chat" ? "text-primary" : "text-muted-foreground/60",
            )}
          >
            {rationale.kind === "chat" ? "↩" : rationale.kind === "typed" ? "✎" : "↳"}
          </span>
          {rationale.kind === "chat" ? `“${rationale.text}”` : rationale.text}
        </p>
      )}

      {/* Guided: the branches this framework puts under here. An offer, not an
          insertion — one tap accepts, and the whole strip is dismissible. */}
      {offers.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center gap-1 rounded-lg border border-dashed p-1">
          <span className="w-full text-[9px] uppercase tracking-wide text-muted-foreground">
            suggested
            <button
              onClick={() => api.dismissOffers(node.id)}
              className="float-right px-0.5 hover:text-foreground"
              aria-label="Dismiss suggestions"
            >
              ✕
            </button>
          </span>
          {offers.map((t) => (
            <button
              key={t.label}
              onClick={() => api.acceptOffer(node.id, t.label)}
              title={t.hints?.length ? t.hints.join(" · ") : `Add "${t.label}"`}
              className="max-w-full truncate rounded-full border border-dashed border-primary/40 px-1.5 py-0.5 text-[10px] text-primary hover:bg-primary/10"
            >
              <Plus className="mr-0.5 inline h-2.5 w-2.5" />
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* A corpus leaf's prompts. Quieter than the chips on purpose — a hint is
          a thought worth having, not a box the framework says you need. */}
      {hints.length > 0 && (
        <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1 px-1 text-[10px] leading-tight text-muted-foreground">
          <span className="text-muted-foreground/60">consider</span>
          {hints.map((h) => (
            <button
              key={h}
              onClick={() => api.acceptOffer(node.id, h)}
              title={`Add "${h}" as a branch`}
              className="underline decoration-dotted underline-offset-2 hover:text-primary"
            >
              {h}
            </button>
          ))}
        </p>
      )}

      {/* Actions sit on the card's own row so they never collide with the
          connectors leaving its bottom edge. */}
      <div className="mt-1 flex items-center gap-1 border-t pt-1">
        {childCount > 0 && (
          <button
            onClick={() => api.toggleFold(node.id)}
            className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
            aria-label={folded ? "Expand branch" : "Collapse branch"}
            aria-expanded={!folded}
          >
            {folded ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            {folded && <span>{childCount}</span>}
          </button>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {api.hasDataPack && api.onAskAbout && (
            <button
              onClick={() => api.onAskAbout?.(node.label.trim() || "this branch")}
              className="text-muted-foreground hover:text-primary"
              title="Ask the interviewer about this branch"
              aria-label="Ask about this branch"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => api.addChild(node.id)}
            className="text-muted-foreground hover:text-primary"
            title="Add a branch under this one"
            aria-label="Add a branch under this one"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => api.requestRemove(node.id)}
            className="text-muted-foreground hover:text-destructive"
            aria-label="Remove branch"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { saveFramework } from "@/app/actions/practice";
import { evaluateExpression } from "@/lib/calc";
import { branchDiscussed, contradictedAncestors, hasProblemDescendant } from "@/lib/diagnosis";
import type { FrameworkNodeTemplate } from "@/lib/config/frameworks";
import {
  childrenFor,
  completeLabel,
  detectFramework,
  frameworkNamed,
  hintsFor,
  rootsFor,
} from "@/lib/framework-suggest";
import {
  indentNode,
  insertSiblingAfter,
  outdentNode,
  resolveAttachTarget,
  rootIndexOf,
} from "@/lib/framework-tree";
import { NODE_STATUS_META, type AnswerMode, type NodeStatus, type TreeMode } from "@/lib/types";
import {
  isLegacyChildRate,
  isLegacyChildValue,
  parseNodeValue,
  percentBackspace,
  percentField,
  percentStore,
  sanitizePercentInput,
  sanitizeRateInput,
  shareTotalFor,
  sharesOvershoot,
} from "@/lib/framework-value";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn, formatIndianNumber, toIndianWords } from "@/lib/utils";
import {
  STATUS_ROW,
  STATUS_STYLE,
  depthStyle,
  familyStyle,
} from "./framework-depth";
import { FrameworkCanvas } from "./framework-canvas";
import { useMediaQuery } from "./use-media-query";
import type { UiFrameworkNode } from "./types";

/** formatIndianNumber rounds to an integer, which turns fractions like 0.4
 * (from "40%") into a misleading "0" — show small magnitudes with decimals. */
function formatChainValue(n: number): string {
  if (Math.abs(n) < 1) return n.toFixed(3).replace(/\.?0+$/, "") || "0";
  return formatIndianNumber(n);
}

/**
 * Keep the caret in front of the share box's trailing "%". A controlled input
 * drops the caret at the end after each re-render, which would leave it sitting
 * behind the suffix; re-pinning on every caret event puts it back where the
 * next digit will actually land.
 */
function pinPercentCaret(el: HTMLInputElement, legacy: boolean) {
  if (legacy || !el.value.endsWith("%")) return;
  const start = el.selectionStart ?? 0;
  // A range selection (select-all before retyping) is deliberate — leave it.
  if (start !== el.selectionEnd) return;
  const limit = el.value.length - 1;
  if (start > limit) el.setSelectionRange(limit, limit);
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

/** Traffic light, in the order a candidate cycles through it. */
const STATUS_CYCLE: NodeStatus[] = ["unknown", "healthy", "problem"];

/** Stable identity, so a default prop doesn't retrigger effects every render. */
const EMPTY_DEMO: UiFrameworkNode[] = [];

export function FrameworkBuilder({
  attemptId,
  nodes,
  onChange,
  onChainResult,
  answerMode = "numeric",
  treeMode = null,
  hasDataPack = false,
  onAskAbout,
  messageText,
  conversation = [],
  questionFramework = null,
  canvasFill = false,
  onFullscreen,
  demoNodes = EMPTY_DEMO,
}: {
  attemptId: string;
  nodes: UiFrameworkNode[];
  onChange: (nodes: UiFrameworkNode[]) => void;
  onChainResult?: (n: number) => void;
  answerMode?: AnswerMode;
  treeMode?: TreeMode | null;
  hasDataPack?: boolean;
  /** Sends "tell me about this branch" into the chat. */
  onAskAbout?: (label: string) => void;
  /** Message id → text, so a promoted node can show the sentence it came from. */
  messageText?: Map<string, string>;
  /** Every turn so far, for the "did you ask before judging?" check. */
  conversation?: string[];
  /** The framework this case is authored against, when it declares one. */
  questionFramework?: string | null;
  /** Fullscreen: the canvas fills its parent rather than taking a fixed height. */
  canvasFill?: boolean;
  /** Omitted when already fullscreen, which hides the expand control. */
  onFullscreen?: () => void;
  /**
   * Tutorial illustration branches. Merged into what the canvas draws and
   * nowhere else — deliberately kept out of `nodes`, which is debounce-saved
   * wholesale, so a demo branch can never be persisted or scored.
   */
  demoNodes?: UiFrameworkNode[];
}) {
  const qualitative = answerMode === "qualitative";
  /**
   * Both trees are drawn as a flow diagram, but only where there is room for
   * one. Below this the panel is a phone-width tab, where a pannable canvas is
   * unusable and the indented outline is genuinely the better tool — so the
   * outline stays, rather than being replaced everywhere.
   */
  const isWide = useMediaQuery("(min-width: 1024px)");
  const asCanvas = isWide;
  const [dragId, setDragId] = useState<string | null>(null);
  const [customLabel, setCustomLabel] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const dragIdRef = useRef<string | null>(null);
  /**
   * Folding is a view concern, so it lives in component state rather than the
   * saved tree. `opened` records branches the user expanded by hand: a healthy
   * branch folds itself away (it has been eliminated, so it costs a line instead
   * of a screen), but a manual expand always wins — nothing the user opened is
   * allowed to close itself again.
   */
  const [folded, setFolded] = useState<Set<string>>(new Set());
  const [opened, setOpened] = useState<Set<string>>(new Set());
  /**
   * Branches Guided has offered under a node and the candidate hasn't dealt with
   * yet. Offers are transient: dismissed here, never persisted, and never
   * inserted without a tap — a chip is an offer, and accepting it is the
   * decision that keeps the exercise the candidate's.
   */
  const [dismissedOffers, setDismissedOffers] = useState<Set<string>>(new Set());
  /** Its own flag: `dismissedOffers` is keyed by node id, and roots have none. */
  const [rootOffersDismissed, setRootOffersDismissed] = useState(false);
  /** The row that should take focus after a keyboard edit restructures the tree. */
  const focusNext = useRef<string | null>(null);
  /** Ghost completion belongs to the row being typed in, not the whole tree. */
  const [focusedId, setFocusedId] = useState<string | null>(null);
  /** The branch awaiting a delete confirmation. Owned here, so both views share it. */
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    label: string;
    descendants: number;
  } | null>(null);

  // A keyboard edit that restructures the tree (Enter, Tab, Backspace) has to
  // put the caret where the user expects it once React has re-rendered the rows.
  const labelRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  useEffect(() => {
    const id = focusNext.current;
    if (!id) return;
    focusNext.current = null;
    labelRefs.current.get(id)?.focus();
  }, [nodes]);

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
          multiplier: n.multiplier ?? undefined,
          combine: n.combine,
          status: n.status ?? undefined,
          note: n.note ?? undefined,
          sourceMessageId: n.sourceMessageId ?? undefined,
          origin: n.origin ?? undefined,
        })),
      ).catch(() => {});
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  function add(parentId: string | null, label: string) {
    onChange([...nodes, blankNode(parentId, label)]);
  }
  function blankNode(parentId: string | null, label: string): UiFrameworkNode {
    return {
      id: newId(),
      parentId,
      label,
      value: "",
      multiplier: "",
      combine: "sum",
      ...(qualitative ? { status: "unknown" as NodeStatus, origin: "manual" as const } : {}),
    };
  }
  /**
   * Where a picked step lands, and the one place the two modes disagree about
   * shape rather than about fields.
   *
   * An estimate is ONE narrowing chain — population sliced by segmentation times
   * frequency — so every pick after the first extends the tip. An issue tree is
   * the opposite: Revenue and Cost are peers, and a case usually opens with two
   * or three top-level branches. So qualitative picks start new roots.
   */
  function addStep(label: string) {
    add(qualitative ? null : (resolveAttachTarget(nodes)?.id ?? null), label);
  }
  function addCustom() {
    const label = customLabel.trim();
    if (!label) return;
    addStep(label);
    setCustomLabel("");
  }
  function addChild(parentId: string) {
    add(parentId, "New step");
  }
  function childrenOf(id: string): UiFrameworkNode[] {
    return nodes.filter((n) => n.parentId === id);
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
  function setMultiplier(id: string, multiplier: string) {
    onChange(nodes.map((n) => (n.id === id ? { ...n, multiplier } : n)));
  }
  function setCombine(id: string, combine: "sum" | "multiply") {
    onChange(nodes.map((n) => (n.id === id ? { ...n, combine } : n)));
  }
  /**
   * Ask before destroying anything worth keeping.
   *
   * `remove` takes the whole subtree, so one stray click on a branch that took
   * five minutes to build is unrecoverable — there is no undo. A blank childless
   * node has nothing to lose though, and marking a branch "problem" mints one of
   * those every time, so confirming those too would just tax the main loop.
   */
  function requestRemove(id: string) {
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    const descendants = collectDescendantIds(id).length;
    if (!node.label.trim() && descendants === 0) {
      remove(id);
      return;
    }
    setPendingDelete({ id, label: node.label.trim(), descendants });
  }

  /**
   * Advance a branch's traffic light — and, when it turns red, open the next
   * question.
   *
   * Marking "problem" means "the cause is somewhere in here", which is only
   * useful if the candidate then looks inside. So a red mark on a childless
   * branch immediately creates the first child and focuses it: one gesture both
   * records the judgement and asks "where in here?", which is what keeps a case
   * moving under a timer. A red mark never touches the parent — "the problem is
   * in here" and "this is the cause" are separate claims.
   *
   * Marking "healthy" folds the branch away: it has been eliminated, so it earns
   * a line rather than a screen.
   */
  /**
   * Can this branch be cleared? Not while something inside it is marked as the
   * problem — "the problem is in X" and "the problem is nowhere in X" cannot
   * both be true. See `lib/diagnosis.ts`.
   */
  function healthyBlocked(id: string): boolean {
    return hasProblemDescendant(nodes, id);
  }

  function cycleStatus(id: string) {
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    // Healthy drops out of the cycle entirely while the branch contains a
    // problem, rather than being offered and then rejected.
    const blocked = healthyBlocked(id);
    const cycle = blocked ? STATUS_CYCLE.filter((s) => s !== "healthy") : STATUS_CYCLE;
    const current = (node.status ?? "unknown") as NodeStatus;
    // A node already marked healthy isn't in the reduced cycle (indexOf -1), so
    // it steps to the front of it — back to unexamined.
    const next = cycle[(cycle.indexOf(current) + 1) % cycle.length];

    // Marking this branch as the problem withdraws any ancestor's claim to have
    // cleared it. Withdrawn to "unexamined", never promoted to "problem": the
    // app does not get to assert a judgement the candidate never made.
    const withdrawn =
      next === "problem" ? new Set(contradictedAncestors(nodes, id)) : new Set<string>();

    let updated = nodes.map((n) =>
      n.id === id
        ? { ...n, status: next }
        : withdrawn.has(n.id)
          ? { ...n, status: "unknown" as NodeStatus }
          : n,
    );
    // A withdrawn branch was folded away when it was cleared; it is back in play
    // now, and leaving it collapsed would hide the trail being built inside it.
    if (withdrawn.size > 0) {
      setFolded((prev) => {
        const copy = new Set(prev);
        for (const wid of withdrawn) copy.delete(wid);
        return copy;
      });
    }

    if (next === "problem" && childrenOf(id).length === 0) {
      const child = blankNode(id, "");
      updated = [...updated, child];
      focusNext.current = child.id;
      setOpened((prev) => new Set(prev).add(id));
      setFolded((prev) => {
        const copy = new Set(prev);
        copy.delete(id);
        return copy;
      });
    }
    if (next === "healthy") {
      setFolded((prev) => new Set(prev).add(id));
      setOpened((prev) => {
        const copy = new Set(prev);
        copy.delete(id);
        return copy;
      });
    }
    onChange(updated);
  }

  function toggleFold(id: string) {
    const isFolded = folded.has(id) && !opened.has(id);
    if (isFolded) {
      setOpened((prev) => new Set(prev).add(id));
      setFolded((prev) => {
        const copy = new Set(prev);
        copy.delete(id);
        return copy;
      });
    } else {
      setFolded((prev) => new Set(prev).add(id));
      setOpened((prev) => {
        const copy = new Set(prev);
        copy.delete(id);
        return copy;
      });
    }
  }

  /**
   * Outline keys on the label input only. Every other field keeps native
   * tabbing, and `Alt+←/→` mirrors indent/outdent for anyone who needs Tab to
   * keep moving focus. Each of these has a mouse equivalent too — the row's "+",
   * the bin, the drag handle — so nothing here is the only way to do anything.
   */
  function handleLabelKeyDown(
    e: ReactKeyboardEvent<HTMLInputElement>,
    node: UiFrameworkNode,
    ghost?: string | null,
  ) {
    // Tab accepts a pending completion before it means "indent" — the caret is
    // mid-word, so indenting is not what the candidate is asking for. Accepting
    // a framework's NAME brings its top level with it, which is the two-keystroke
    // path from "profit…" to a whole structure.
    if (ghost && e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      const named = frameworkNamed(ghost);
      if (named && guided) {
        // The framework itself isn't a branch — replace the row with its roots.
        const roots = rootsFor(named).map((t) => ({
          ...blankNode(node.parentId, t.label),
          origin: "scaffold" as const,
        }));
        const withoutPlaceholder = nodes.filter((n) => n.id !== node.id);
        focusNext.current = roots[0]?.id ?? null;
        onChange([...withoutPlaceholder, ...roots]);
      } else {
        setLabel(node.id, ghost);
      }
      return;
    }

    const isIndent = e.key === "Tab" && !e.shiftKey;
    const isOutdent = (e.key === "Tab" && e.shiftKey) || (e.altKey && e.key === "ArrowLeft");
    const isAltIndent = e.altKey && e.key === "ArrowRight";

    if (e.key === "Enter") {
      e.preventDefault();
      const fresh = blankNode(node.parentId, "");
      focusNext.current = fresh.id;
      onChange(insertSiblingAfter(nodes, node.id, fresh));
      return;
    }
    if (isIndent || isAltIndent) {
      e.preventDefault();
      focusNext.current = node.id;
      onChange(indentNode(nodes, node.id));
      return;
    }
    if (isOutdent) {
      e.preventDefault();
      focusNext.current = node.id;
      onChange(outdentNode(nodes, node.id));
      return;
    }
    // Backspace on an already-empty label removes the row, but only when it has
    // nothing underneath — deleting a subtree by holding backspace would be a
    // nasty way to lose work.
    if (e.key === "Backspace" && !node.label && childrenOf(node.id).length === 0) {
      e.preventDefault();
      const siblings = nodes.filter((n) => n.parentId === node.parentId);
      const position = siblings.findIndex((s) => s.id === node.id);
      const previous = position > 0 ? siblings[position - 1] : null;
      focusNext.current = previous?.id ?? node.parentId ?? null;
      remove(node.id);
    }
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
    // Same feature, different axis. Siblings are stacked in the outline and sit
    // shoulder to shoulder on the canvas, so the drop target is whichever one
    // the pointer is over along the axis they actually vary on.
    const overNode = siblings.find((s) => {
      const el = rowRefs.current.get(s.id);
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return asCanvas
        ? e.clientX >= rect.left && e.clientX <= rect.right
        : e.clientY >= rect.top && e.clientY <= rect.bottom;
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
  //     its share (`value`) × its rate (`multiplier`). This is what the row
  //     displays, so a top-level step shows exactly what was typed and a "30%"
  //     child shows 30% OF its parent. It does not move when children are added
  //     or edited.
  //   rollup — what the step contributes UPWARD: a leaf contributes its
  //     resolved value; a parent combines its branches via Sum or Multiply
  //     (its own manual toggle). Only this feeds the Chain result below.
  /**
   * What gets DRAWN: the real tree plus any tutorial illustration.
   *
   * The maps below are derived render state, so the examples have to be in here
   * or a numeric demo card would resolve to nothing and show "= –" — it would
   * demonstrate the layout and none of the arithmetic. `nodes` remains the
   * source for everything that leaves the component: persistence, the attach
   * target, and the chain result.
   */
  const renderNodes = demoNodes.length ? [...nodes, ...demoNodes] : nodes;
  const byParent = new Map<string | null, UiFrameworkNode[]>();
  for (const n of renderNodes) {
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
    const rate = parseNodeValue(node.multiplier) ?? 1;
    const resolved = inherited * own * rate;
    const live = inheritedLive || !!node.value?.trim() || !!node.multiplier?.trim();
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
  /** Where the palette and the custom-step box will drop their next step. */
  const attachTarget = resolveAttachTarget(nodes);
  /** A step the user hasn't named yet still has to be referrable to. */
  const attachName = attachTarget && (attachTarget.label.trim() || "the step above");

  // Which framework this tree is in. The question's own declaration outranks
  // inference — it is a fact, not a guess — and detection is sticky, so one
  // ambiguous branch added late doesn't switch the tree's framework.
  const guess = qualitative
    ? detectFramework(
        nodes.map((n) => n.label),
        { authored: questionFramework, established: questionFramework },
      )
    : { framework: null, confident: false, candidates: [] };
  const activeFramework = guess.framework;
  const guided = qualitative && treeMode === "guided";

  /** The branches a framework would put under this node, minus what's there. */
  function offersFor(node: UiFrameworkNode): FrameworkNodeTemplate[] {
    if (!guided || dismissedOffers.has(node.id) || !node.label.trim()) return [];
    const existing = new Set(
      childrenOf(node.id).map((c) => c.label.trim().toLowerCase()),
    );
    return childrenFor(activeFramework, node.label).filter(
      (t) => !existing.has(t.label.toLowerCase()),
    );
  }

  /**
   * The framework's own top level, minus whatever the tree already has.
   *
   * Exactly `offersFor`'s rule, one level up — which is what this was missing.
   * Gating the strip on an empty tree meant accepting Revenue took Cost away
   * with it, so Guided handed over half a top level and then went quiet. The
   * offers shrink one at a time instead, and a deleted root is offered again.
   */
  function rootOffers(): FrameworkNodeTemplate[] {
    if (!guided || rootOffersDismissed) return [];
    const existing = new Set(roots.map((r) => r.label.trim().toLowerCase()));
    return rootsFor(activeFramework).filter((t) => !existing.has(t.label.toLowerCase()));
  }

  /**
   * The prompts a framework leaf carries instead of children.
   *
   * Without these, accepting a chip for something like "Procuring Raw Materials"
   * offers nothing further and the tree bottoms out — the corpus's most specific
   * detail would only ever be seen as a tooltip on a chip that no longer exists.
   * Filtered against what's already there, exactly like the child offers.
   */
  function hintsForNode(node: UiFrameworkNode): string[] {
    if (!guided || dismissedOffers.has(node.id) || !node.label.trim()) return [];
    const existing = new Set(childrenOf(node.id).map((c) => c.label.trim().toLowerCase()));
    return hintsFor(activeFramework, node.label).filter(
      (h) => !existing.has(h.toLowerCase()),
    );
  }

  /** `null` adds a root — the framework's own top level, offered on an empty tree. */
  function acceptOffer(parentId: string | null, label: string) {
    const fresh = blankNode(parentId, label);
    onChange([...nodes, { ...fresh, origin: "scaffold" as const }]);
    if (parentId) setOpened((prev) => new Set(prev).add(parentId));
  }

  function dismissOffers(nodeId: string) {
    setDismissedOffers((prev) => new Set(prev).add(nodeId));
  }

  // Shared with the canvas, so both views fold the same branches and complete
  // the same labels — the state lives here and only the drawing differs.
  function isNodeFolded(nodeId: string, childCount: number): boolean {
    return childCount > 0 && folded.has(nodeId) && !opened.has(nodeId);
  }
  function ghostFor(node: UiFrameworkNode): string | null {
    // Only for the row being typed in — a whole tree of ghosts would be noise.
    return focusedId === node.id ? completeLabel(node.label, activeFramework) : null;
  }
  function registerLabelRef(id: string, el: HTMLInputElement | null) {
    if (el) labelRefs.current.set(id, el);
    else labelRefs.current.delete(id);
  }
  function registerRowRef(id: string, el: HTMLElement | null) {
    if (el) rowRefs.current.set(id, el as HTMLDivElement);
    else rowRefs.current.delete(id);
  }
  /** A field that has text in it but doesn't parse — silently treated as ×1. */
  function isUnrecognized(raw: string | null | undefined): boolean {
    return !!raw?.trim() && parseNodeValue(raw) === null;
  }
  const anyParsed = nodes.some(
    (n) => parseNodeValue(n.value) !== null || parseNodeValue(n.multiplier) !== null,
  );
  /**
   * The chain result sums REAL roots only.
   *
   * This is the line that keeps the tutorial out of the candidate's answer.
   * `roots` comes from the merged render tree, so an example root is sitting in
   * it while a demo step is on screen — and this total feeds "Use as final
   * estimate", one click from being submitted.
   */
  const grandTotal = anyParsed
    ? roots
        .filter((r) => !r.id.startsWith("demo:"))
        .reduce((sum, r) => sum + (rollupMap.get(r.id) ?? 0), 0)
    : null;
  const unrecognizedCount = nodes.filter(
    (n) => isUnrecognized(n.value) || isUnrecognized(n.multiplier),
  ).length;

  // `depth` drives the nesting colour only — the tree itself is walked through
  // `byParent`, so it's a render concern, not part of the data.
  function renderNode(node: UiFrameworkNode, depth: number) {
    const children = byParent.get(node.id) ?? [];
    // Numeric colours by depth (one root, so depth is the only axis). Qualitative
    // colours by family — hue from the root branch, shade from depth — because
    // with several roots "same colour = same top-level branch" has to read first.
    const tint = qualitative ? familyStyle(rootIndexOf(nodes, node.id), depth) : depthStyle(depth);
    if (qualitative) return renderQualitativeNode(node, depth, children, tint);
    const resolved = resolvedMap.get(node.id) ?? 0;
    const ownUnrecognized = isUnrecognized(node.value) || isUnrecognized(node.multiplier);
    const showValue = liveMap.get(node.id) ?? false;
    // A child step is a slice of its parent, so its boxes are constrained: a
    // 0–100% share, and a plain positive rate. Only a root step can name an
    // absolute quantity to start the chain from.
    const isChild = node.parentId !== null;
    const legacyValue = isChild && isLegacyChildValue(node.value);
    const legacyRate = isChild && isLegacyChildRate(node.multiplier);
    const shareTotal = node.combine === "sum" ? shareTotalFor(children) : null;
    const shareOff = shareTotal !== null && sharesOvershoot(shareTotal);

    return (
      // Containment carries the hierarchy: this box holds the step's own row and
      // every descendant's box, each a level further along the colour ramp.
      <div
        key={node.id}
        className={cn("space-y-1.5 rounded-xl border p-1.5", tint.box)}
      >
        <div
          ref={(el) => {
            if (el) rowRefs.current.set(node.id, el);
            else rowRefs.current.delete(node.id);
          }}
          className={cn(
            // Wraps rather than crushing the inputs: on a narrow panel the
            // trailing group (rate, result, actions) drops to a second line
            // instead of squeezing the value box down to a few pixels.
            "flex flex-wrap items-center gap-1.5 rounded-lg border bg-card p-2",
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
            <GripVertical className={cn("h-4 w-4", tint.grip)} />
          </span>
          <Input
            value={node.label}
            onChange={(e) => setLabel(node.id, e.target.value)}
            placeholder="Step name"
            className="h-7 min-w-[5rem] flex-1 border-0 bg-transparent px-1 text-sm font-medium shadow-none focus-visible:ring-0"
          />
          {isChild ? (
            <Input
              value={legacyValue ? (node.value ?? "") : percentField(node.value)}
              onChange={(e) => {
                const next = sanitizePercentInput(e.target.value);
                if (next !== null) setValue(node.id, percentStore(next));
              }}
              onKeyDown={(e) => {
                if (legacyValue || e.key !== "Backspace") return;
                const el = e.currentTarget;
                const end = el.value.length;
                if (el.selectionStart !== end || el.selectionEnd !== end) return;
                e.preventDefault();
                setValue(node.id, percentBackspace(node.value));
              }}
              onKeyUp={(e) => pinPercentCaret(e.currentTarget, legacyValue)}
              onFocus={(e) => pinPercentCaret(e.currentTarget, legacyValue)}
              onClick={(e) => pinPercentCaret(e.currentTarget, legacyValue)}
              onSelect={(e) => pinPercentCaret(e.currentTarget, legacyValue)}
              inputMode="decimal"
              placeholder="0–100%"
              aria-label="Share of parent, 0–100%"
              title={
                legacyValue
                  ? "Not a share — a branch takes 0–100% of its step above. Editing this box replaces it."
                  : "This branch's share of the step above, 0–100%. An absolute figure belongs on a starting step; a rate goes in the × box."
              }
              className={cn(
                "h-7 w-[4.5rem] shrink-0 rounded-md border border-input bg-background px-1.5 text-xs shadow-none focus-visible:ring-1 focus-visible:ring-offset-0",
                legacyValue && "border-amber-500 text-amber-600",
              )}
            />
          ) : (
            <Input
              value={node.value ?? ""}
              onChange={(e) => setValue(node.id, e.target.value)}
              placeholder="value / %"
              title="This starting step's value — an absolute figure (1.3cr). Branches under it take a share of it."
              className="h-7 w-16 shrink-0 rounded-md border border-input bg-background px-1.5 text-xs shadow-none focus-visible:ring-1 focus-visible:ring-offset-0"
            />
          )}
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <span
              aria-hidden
              className={cn(
                "font-mono text-[11px]",
                node.multiplier?.trim() ? "text-muted-foreground" : "text-muted-foreground/40",
              )}
            >
              ×
            </span>
            <Input
              value={node.multiplier ?? ""}
              onChange={(e) => {
                if (!isChild) return setMultiplier(node.id, e.target.value);
                const next = sanitizeRateInput(e.target.value);
                if (next !== null) setMultiplier(node.id, next);
              }}
              placeholder="1"
              inputMode={isChild ? "decimal" : undefined}
              aria-label="Rate multiplier for this step"
              title="A rate on top of the share — 3 for “3 cups a day each”. Blank counts as ×1."
              className={cn(
                "h-7 w-12 shrink-0 rounded-md border border-input bg-background px-1.5 text-xs shadow-none focus-visible:ring-1 focus-visible:ring-offset-0",
                legacyRate && "border-amber-500 text-amber-600",
              )}
            />
            <span
              className={cn(
                "font-mono text-[11px]",
                ownUnrecognized ? "text-amber-600" : "text-muted-foreground",
              )}
              title={
                ownUnrecognized
                  ? "Not a recognized number/% — treated as ×1"
                  : showValue
                    ? "This step's own value — its share of its parent, times its rate"
                    : "No value entered in this branch yet"
              }
            >
              {showValue ? formatChainValue(resolved) : "–"}
              {ownUnrecognized && "!"}
            </span>
            <button
              onClick={() => addChild(node.id)}
              className="text-muted-foreground hover:text-primary"
              aria-label="Add branch under this step"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => remove(node.id)}
              className="text-muted-foreground hover:text-destructive"
              aria-label="Remove step"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {children.length >= 2 && (
          <div className="ml-1 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
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
                className={cn("font-mono", shareOff ? "text-amber-600" : "text-muted-foreground")}
                title={
                  shareOff
                    ? "These branches claim more than the whole step — something is being counted twice."
                    : "How much of the step these branches cover. Under 100% is fine: you only have to model the slices your estimate needs."
                }
              >
                {shareOff ? "⚠ over the whole: " : "· covers "}
                {Math.round(shareTotal * 10) / 10}% of the step
              </span>
            )}
          </div>
        )}

        {children.length > 0 && (
          // A small left inset on top of the containment: the boxes alone read
          // as nesting, but the staircase makes the level obvious at a glance.
          <div className="ml-3 space-y-1.5">
            {children.map((c) => renderNode(c, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  /**
   * A qualitative row: no value, no rate, no computed figure. What replaces them
   * is a judgement (the traffic light), a way to check it (the magnifier) and a
   * rationale the candidate did not have to type — the sentence they said in
   * chat, or a fact the interviewer gave them, shown as a subtitle.
   */
  function renderQualitativeNode(
    node: UiFrameworkNode,
    depth: number,
    children: UiFrameworkNode[],
    tint: { box: string; grip: string },
  ) {
    const status = (node.status ?? "unknown") as NodeStatus;
    const meta = NODE_STATUS_META[status];
    const isFolded = children.length > 0 && folded.has(node.id) && !opened.has(node.id);
    const inherited = node.sourceMessageId ? messageText?.get(node.sourceMessageId) : undefined;
    const subtitle = inherited?.trim() || node.note?.trim() || "";
    // Judging a branch is a claim about the business. Building one is only a
    // hypothesis, so it never warns — this fires on the verdict alone.
    const unevidenced =
      hasDataPack &&
      !!node.label.trim() &&
      !!status &&
      status !== "unknown" &&
      !branchDiscussed(node.label, conversation);
    // Only for the row being typed in — a whole tree of ghosts would be noise.
    const ghost =
      qualitative && focusedId === node.id ? completeLabel(node.label, activeFramework) : null;

    return (
      <div key={node.id} className={cn("space-y-1 rounded-xl border p-1", tint.box)}>
        <div
          ref={(el) => {
            if (el) rowRefs.current.set(node.id, el);
            else rowRefs.current.delete(node.id);
          }}
          className={cn(
            "group/row flex flex-wrap items-start gap-1.5 rounded-lg border p-1.5",
            STATUS_ROW[status],
            dragId === node.id && "opacity-50",
          )}
        >
          <span
            onPointerDown={(e) => handleGripPointerDown(e, node.id)}
            onPointerMove={handleGripPointerMove}
            onPointerUp={handleGripPointerUp}
            onPointerCancel={handleGripPointerUp}
            style={{ touchAction: "none" }}
            className="mt-0.5 shrink-0 cursor-grab touch-none active:cursor-grabbing"
          >
            <GripVertical className={cn("h-4 w-4", tint.grip)} />
          </span>

          {children.length > 0 && (
            <button
              onClick={() => toggleFold(node.id)}
              className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
              aria-label={isFolded ? "Expand branch" : "Collapse branch"}
              aria-expanded={!isFolded}
            >
              {isFolded ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          )}

          <div className="flex min-w-0 flex-1 flex-col">
            {/* Ghost completion sits behind the input, showing only the part
                still to type. Free in both modes — it saves keystrokes, not
                reasoning, which is the line the whole feature set draws. */}
            <div className="relative">
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
                ref={(el) => {
                  if (el) labelRefs.current.set(node.id, el);
                  else labelRefs.current.delete(node.id);
                }}
                value={node.label}
                onChange={(e) => setLabel(node.id, e.target.value)}
                onKeyDown={(e) => handleLabelKeyDown(e, node, ghost)}
                onFocus={() => setFocusedId(node.id)}
                onBlur={() => setFocusedId((id) => (id === node.id ? null : id))}
                placeholder="Name this branch"
                className="relative h-6 min-w-[5rem] flex-1 border-0 bg-transparent px-1 text-sm font-medium shadow-none focus-visible:ring-0"
              />
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
            {/* Read-only. A branch earns its reasoning by being talked through
                in the chat rather than annotated in a box — which is also the
                rationale `deriveAssumptions` rates highest. Anything typed
                before the box was removed is still shown. */}
            {subtitle && (
              <p className="px-1 pt-0.5 text-[11px] leading-snug text-muted-foreground">
                <span className={cn("mr-1 font-mono", inherited ? "text-primary" : "text-muted-foreground/60")}>
                  {inherited ? "↩" : "✎"}
                </span>
                {inherited ? `“${subtitle}”` : subtitle}
              </p>
            )}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 pt-px">
            <button
              onClick={() => cycleStatus(node.id)}
              title={
                healthyBlocked(node.id)
                  ? `${meta.label} — ${meta.hint}. Can't be cleared: a branch inside it is marked as the problem.`
                  : `${meta.label} — ${meta.hint}. Click to change.`
              }
              aria-label={`Status: ${meta.label}`}
              className={cn(
                "h-5 rounded border px-1.5 font-mono text-[10px] font-semibold transition-colors",
                STATUS_STYLE[status],
              )}
            >
              {meta.short}
            </button>
            {hasDataPack && onAskAbout && (
              <button
                onClick={() => onAskAbout(node.label.trim() || "this branch")}
                className="text-muted-foreground hover:text-primary"
                title="Ask the interviewer about this branch"
                aria-label="Ask about this branch"
              >
                <Search className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={() => addChild(node.id)}
              className="text-muted-foreground hover:text-primary"
              aria-label="Add a branch under this step"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => requestRemove(node.id)}
              className="text-muted-foreground hover:text-destructive"
              aria-label="Remove branch"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Guided: the branches this framework puts under here. Greyed, one tap
            to accept, and dismissible — an offer, not an insertion, so choosing
            which branch to take stays the candidate's decision at every level. */}
        {(() => {
          const offers = offersFor(node);
          if (offers.length === 0) return null;
          return (
            <div className="ml-2 flex flex-wrap items-center gap-1 rounded-lg border border-dashed p-1.5">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                suggested
              </span>
              {offers.map((t) => (
                <button
                  key={t.label}
                  onClick={() => acceptOffer(node.id, t.label)}
                  title={t.hints?.length ? t.hints.join(" · ") : `Add "${t.label}"`}
                  className="rounded-full border border-dashed border-primary/40 px-2 py-0.5 text-[11px] text-primary hover:bg-primary/10"
                >
                  <Plus className="mr-0.5 inline h-2.5 w-2.5" />
                  {t.label}
                </button>
              ))}
              <button
                onClick={() => dismissOffers(node.id)}
                className="ml-auto px-1 text-[11px] text-muted-foreground hover:text-foreground"
                aria-label="Dismiss suggestions"
              >
                ✕
              </button>
            </div>
          );
        })()}

        {/* A leaf's prompts. Quieter than the chip strip on purpose — a hint is
            a thought worth having, not a box the framework says you need. */}
        {(() => {
          const hints = hintsForNode(node);
          if (hints.length === 0) return null;
          return (
            <p className="ml-2 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 px-1 text-[11px] text-muted-foreground">
              <span className="text-muted-foreground/60">consider</span>
              {hints.map((h, i) => (
                <span key={h} className="contents">
                  <button
                    onClick={() => acceptOffer(node.id, h)}
                    title={`Add "${h}" as a branch`}
                    className="underline decoration-dotted underline-offset-2 hover:text-primary"
                  >
                    {h}
                  </button>
                  {i < hints.length - 1 && <span className="text-muted-foreground/40">·</span>}
                </span>
              ))}
            </p>
          );
        })()}

        {children.length > 0 &&
          (isFolded ? (
            <button
              onClick={() => toggleFold(node.id)}
              className="ml-3 block text-left text-[11px] text-muted-foreground hover:text-foreground"
            >
              {children.length} branch{children.length === 1 ? "" : "es"} hidden — show
            </button>
          ) : (
            // A tighter inset than the numeric builder, tighter still past the
            // first couple of levels: an issue tree goes deeper, and the indent
            // is what runs the row out of width. Containment and the family hue
            // already carry the nesting, so the staircase only has to hint.
            <div className={cn("space-y-1", depth >= 2 ? "ml-1" : "ml-2")}>
              {children.map((c) => renderNode(c, depth + 1))}
            </div>
          ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", canvasFill && "flex h-full min-h-0 flex-col")}>
      {!qualitative && (
        <div className="flex flex-wrap gap-1.5">
          {PALETTE.map((p) => (
            <button
              key={p}
              onClick={() => addStep(p)}
              title={
                attachName
                  ? `Adds a step under “${attachName}”, continuing the chain`
                  : "Adds the starting step this estimate builds from"
              }
              className="rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary"
            >
              <Plus className="mr-1 inline h-3 w-3" />
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Which mode this attempt is in. It is fixed at creation and changes how
          the tree is scored, so leaving it invisible made a mode that silently
          failed to start impossible to notice. */}
      {qualitative && treeMode && (
        <div className="flex items-center gap-1.5" data-tour="tree-mode">
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
              guided
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-input text-muted-foreground",
            )}
            title={
              guided
                ? "Guided: branches are suggested as you name each parent. Structure isn't scored."
                : "Solo: you build the structure yourself, and it's scored."
            }
          >
            {guided ? "Guided" : "Solo"}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {guided ? "structure suggested, not scored" : "your own structure, scored"}
          </span>
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <Input
          value={customLabel}
          onChange={(e) => setCustomLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCustom()}
          placeholder={
            qualitative ? "Add a branch (e.g. Revenue)" : "Custom step (e.g. Conversion Rate)"
          }
          className="h-7 flex-1 text-xs"
        />
        <Button variant="secondary" onClick={addCustom} className="h-7 shrink-0 px-2.5 text-xs">
          <Plus className="mr-1 h-3 w-3" /> Add
        </Button>
      </div>

      {/* The canvas carries its own version of this line, under the diagram. */}
      {qualitative ? (
        !asCanvas && (
          <p className="text-[11px] text-muted-foreground">
            New branches sit <span className="font-medium text-foreground">side by side</span>. To
            break one down, use its <Plus className="inline h-3 w-3 align-text-bottom" /> — or
            press <span className="font-mono">Enter</span> for the next branch and{" "}
            <span className="font-mono">Tab</span> to nest it under the one above.
          </p>
        )
      ) : (
        // Where the next pick lands, so nesting doesn't read as a misfired button.
        attachName && (
          <p className="text-[11px] text-muted-foreground">
            Next step goes under <span className="font-medium text-foreground">{attachName}</span>.
            To split a step into segments instead, use that {asCanvas ? "card" : "row"}&apos;s{" "}
            <Plus className="inline h-3 w-3 align-text-bottom" />.
          </p>
        )
      )}

      {/* Guided's opening move, and it stays open. Without this the mode offered
          nothing at all until a branch was already named and matched the corpus.
          It survives the first pick because a top level is a set, not a single
          choice — taking Revenue says nothing about whether you still want Cost. */}
      {(() => {
        const offers = rootOffers();
        if (offers.length === 0) return null;
        return (
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-dashed p-2">
            <span className="flex w-full items-center text-[10px] uppercase tracking-wide text-muted-foreground">
              {roots.length === 0 ? "start with" : "suggested top level"} —{" "}
              {activeFramework?.label}
              <button
                onClick={() => setRootOffersDismissed(true)}
                className="ml-auto px-1 hover:text-foreground"
                aria-label="Dismiss top-level suggestions"
              >
                ✕
              </button>
            </span>
            {offers.map((t) => (
              <button
                key={t.label}
                onClick={() => acceptOffer(null, t.label)}
                title={t.hints?.length ? t.hints.join(" · ") : `Add "${t.label}"`}
                className="rounded-full border border-dashed border-primary/40 px-2 py-0.5 text-[11px] text-primary hover:bg-primary/10"
              >
                <Plus className="mr-0.5 inline h-2.5 w-2.5" />
                {t.label}
              </button>
            ))}
          </div>
        );
      })()}

      {/* `roots` comes from the merged render tree, so an illustration counts
          as something to draw — otherwise the tutorial's tree steps would fall
          back to the empty-state text and illustrate nothing. */}
      {roots.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
          {qualitative ? (
            <>
              Start by asking the interviewer what you&apos;re actually solving for — the
              objective, the timeline, how the business makes money. Then break the problem into
              branches here and mark each one as you rule it in or out.
            </>
          ) : (
            <>
              Build your estimation tree — add a starting step above. Each step you add after it
              continues the chain underneath, and a {asCanvas ? "card" : "row"}&apos;s{" "}
              <Plus className="inline h-3 w-3 align-text-bottom" /> branches that step into
              segments. Structure is graded.
            </>
          )}
        </p>
      ) : asCanvas ? (
        <FrameworkCanvas
          nodes={renderNodes}
          isFolded={isNodeFolded}
          ghostFor={ghostFor}
          offersFor={offersFor}
          hintsForNode={hintsForNode}
          setLabel={setLabel}
          cycleStatus={cycleStatus}
          healthyBlocked={healthyBlocked}
          addChild={addChild}
          requestRemove={requestRemove}
          toggleFold={toggleFold}
          acceptOffer={acceptOffer}
          dismissOffers={dismissOffers}
          onLabelKeyDown={handleLabelKeyDown}
          onAskAbout={onAskAbout}
          registerLabelRef={registerLabelRef}
          registerRowRef={registerRowRef}
          onFocusNode={setFocusedId}
          dragId={dragId}
          onGripDown={handleGripPointerDown}
          onGripMove={handleGripPointerMove}
          onGripUp={handleGripPointerUp}
          hasDataPack={hasDataPack}
          conversation={conversation}
          messageText={messageText}
          fill={canvasFill}
          onFullscreen={onFullscreen}
          answerMode={answerMode}
          // The chain's arithmetic stays here; the canvas only draws it.
          numeric={
            qualitative
              ? undefined
              : {
                  setValue,
                  setMultiplier,
                  setCombine,
                  resolvedFor: (id) => resolvedMap.get(id) ?? 0,
                  showValueFor: (id) => liveMap.get(id) ?? false,
                  isUnrecognized,
                  shareTotalFor: (kids) => shareTotalFor(kids),
                  shareIsOff: sharesOvershoot,
                  formatChainValue,
                  pinPercentCaret,
                  isLegacyChildValue,
                  isLegacyChildRate,
                  percentField,
                  percentStore,
                  percentBackspace,
                  sanitizePercentInput,
                  sanitizeRateInput,
                }
          }
        />
      ) : (
        // An issue tree gets deeper than an estimate chain, so the tree scrolls
        // sideways inside its own box rather than pushing the page wide.
        <div className={cn("space-y-1.5", qualitative && "overflow-x-auto")}>
          {roots.map((r) => renderNode(r, 0))}
        </div>
      )}

      {/* The trail lives in the answer bar under the tree, next to Submit —
          repeating it here as well just made the same sentence appear twice. */}

      {roots.length > 0 && !qualitative && (
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
              Give a starting step an absolute value (<span className="font-mono">1.5cr</span>) to
              compute a result. A branch under it takes a share of it instead —{" "}
              <span className="font-mono">40%</span>, between 0 and 100. The{" "}
              <span className="font-mono">×</span> box holds a rate on top of that —{" "}
              <span className="font-mono">30%</span> <span className="font-mono">× 4</span> reads
              &ldquo;a third of them, 4 a day each&rdquo;. Leave either box blank to pass the
              parent's value straight through.
            </p>
          )}
        </div>
      )}

      {/* One dialog for both views — the builder owns `remove`, so it owns the
          question too. Deleting takes the branch's whole subtree and there is no
          undo, so the count is named rather than left to be discovered. */}
      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>Delete this branch?</DialogTitle>
          <DialogDescription>
            {pendingDelete?.descendants
              ? `“${pendingDelete.label || "Untitled"}” and the ${pendingDelete.descendants} branch${
                  pendingDelete.descendants === 1 ? "" : "es"
                } under it will be removed. This can't be undone.`
              : `“${pendingDelete?.label || "Untitled"}” will be removed. This can't be undone.`}
          </DialogDescription>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingDelete) remove(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

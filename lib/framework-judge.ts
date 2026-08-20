import { interviewerReply, isRealProvider } from "@/lib/llm";
import type { FrameworkJudgeContext, InterviewerContext } from "@/lib/llm";
import { toReadableText } from "@/lib/llm/plain-text";

/**
 * Ask the model whether a framework decomposes the question AND whether its
 * numbers hold up.
 *
 * The deterministic rubric can tell that a tree has figures, real branches and
 * shares that do not exceed their parent. Two things stay out of its reach: it
 * cannot tell whether the labels describe *this* problem — six plausible words
 * with numbers attached read, to arithmetic alone, exactly like a real
 * decomposition — and it cannot tell whether the figures are sane, because
 * `parseNode` knows 50 is a number and not that it is a ridiculous population.
 * Both are read here.
 *
 * ## Everything here fails soft
 *
 * A submission is the moment a candidate's work is recorded, and it must not
 * depend on a network call. So every failure — no key, spend guard refused,
 * provider down, reply unparseable, the mock standing in — returns `null`, and
 * `evaluate()` then scores on the deterministic layer alone with no multiplier.
 * The alternative, scoring an attempt lower because a provider was unavailable,
 * would be a worse answer than not asking at all.
 *
 * That is also why this returns a plain number rather than doing the scoring:
 * `evaluate()` stays pure and synchronous, and the whole rubric remains testable
 * without a network or a clock.
 */

/** The judge's answer, when there is one. */
export interface StructureVerdict {
  /** 0–100. Banded by `structureMultiplier` before it moves any score. */
  coherence: number;
  /** One sentence for the candidate, shown as a feedback item. */
  reason: string;
}

/** Nodes as the prompt wants them: depth-first, with depth carrying hierarchy. */
export function flattenForJudge(
  nodes: {
    id?: string;
    parentId?: string | null;
    label: string;
    value?: string | null;
    multiplier?: string | null;
  }[],
): FrameworkJudgeContext["nodes"] {
  const childrenOf = new Map<string | null, typeof nodes>();
  for (const node of nodes) {
    const key = node.parentId ?? null;
    childrenOf.set(key, [...(childrenOf.get(key) ?? []), node]);
  }

  const out: FrameworkJudgeContext["nodes"] = [];
  const walk = (parent: string | null, depth: number, seen: Set<string>) => {
    for (const node of childrenOf.get(parent) ?? []) {
      // A cycle is impossible through the UI and catastrophic here, so it is
      // guarded rather than trusted.
      if (node.id && seen.has(node.id)) continue;
      if (node.id) seen.add(node.id);
      out.push({ depth, label: node.label, value: node.value, rate: node.multiplier });
      if (node.id) walk(node.id, depth + 1, seen);
    }
  };
  walk(null, 0, new Set());

  // A tree whose ids don't line up (older rows, hand-built fixtures) would
  // flatten to nothing, which would read to the model as an empty framework and
  // score it as nonsense. Falling back to the flat list is the honest answer.
  return out.length === nodes.length
    ? out
    : nodes.map((n) => ({ depth: 0, label: n.label, value: n.value, rate: n.multiplier }));
}

/**
 * Pull the verdict out of the reply.
 *
 * Tolerant of the ways a model decorates two lines it was asked for plainly —
 * bold, a trailing percent, a missing REASON — but not of a missing or
 * out-of-range number, which is the one field that changes a score. Anything
 * unparseable is `null` rather than a guess.
 */
export function parseVerdict(text: string): StructureVerdict | null {
  const clean = toReadableText(text);
  const score = clean.match(/COHERENCE\s*[:\-]?\s*\*{0,2}\s*(\d{1,3})/i);
  if (!score) return null;

  const coherence = Number(score[1]);
  if (!Number.isFinite(coherence) || coherence < 0 || coherence > 100) return null;

  const reason = clean.match(/REASON\s*[:\-]?\s*\*{0,2}\s*(.+)/i)?.[1]?.trim() ?? "";
  return { coherence, reason: reason.replace(/\*+/g, "").slice(0, 400) };
}

/**
 * Run the judge, or return `null`.
 *
 * `budgetBlocked` is passed through rather than checked here, so the caller
 * decides with the same `checkBudget` result it uses for everything else on the
 * submit path — and a blocked judge degrades to the mock, whose verdict is then
 * discarded by the `isRealProvider` check below. A made-up score is worse than
 * no score.
 */
export async function judgeFramework(
  judge: FrameworkJudgeContext,
  options: { budgetBlocked?: boolean } = {},
): Promise<StructureVerdict | null> {
  const ctx: InterviewerContext = {
    // The judge branch in `buildReplyMessages` reads `judge` and nothing else,
    // so the rest is the minimum the type requires rather than meaningful state.
    question: {
      title: judge.questionTitle,
      prompt: judge.questionPrompt,
      category: "",
      difficulty: "",
      interviewLevel: "",
      idealLow: null,
      idealHigh: null,
      unit: judge.unit,
      betterApproach: "",
      sampleSolution: "",
    },
    mode: "evaluator",
    answerMode: "numeric",
    messages: [],
    assumptions: [],
    framework: [],
    hintsUsed: 0,
    judge,
  };

  try {
    const { content, outcome } = await interviewerReply(ctx, {
      budgetBlocked: options.budgetBlocked,
    });
    // The mock cannot judge a decomposition — it has no idea what the labels
    // say — so its answer is discarded rather than trusted.
    if (!isRealProvider(outcome.provider)) return null;
    return parseVerdict(content);
  } catch {
    // A submission must never fail because the judge was unavailable.
    return null;
  }
}

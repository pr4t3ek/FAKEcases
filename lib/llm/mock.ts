import { pick, seededRandom } from "@/lib/utils";
import { hintConfig } from "@/lib/config";
import type { InterviewerContext, LlmAdapter } from "./types";

/**
 * Deterministic, context-aware "interviewer" mock. Works fully offline.
 * It reads the candidate's structured state (assumptions, framework, messages)
 * and asks stage-appropriate Socratic questions. It never reveals the answer
 * before Teacher mode or Hint level 3.
 */

const SEGMENTATION_HINTS = [
  "segment",
  "split",
  "adult",
  "child",
  "urban",
  "rural",
  "male",
  "female",
  "age",
  "income",
  "tier",
  "household",
  "%",
  "percent",
];

function lc(s: string): string {
  return s.toLowerCase();
}

function lastUserMessage(ctx: InterviewerContext): string {
  for (let i = ctx.messages.length - 1; i >= 0; i--) {
    if (ctx.messages[i].role === "user") return ctx.messages[i].content;
  }
  return "";
}

function userTurnCount(ctx: InterviewerContext): number {
  return ctx.messages.filter((m) => m.role === "user").length;
}

function hasSegmentation(ctx: InterviewerContext): boolean {
  if (ctx.framework.length >= 2) return true;
  const hay = [
    ...ctx.framework.map((f) => lc(f.label)),
    ...ctx.assumptions.map((a) => `${lc(a.key)} ${lc(a.value)}`),
  ].join(" ");
  return SEGMENTATION_HINTS.some((k) => hay.includes(k));
}

function mentions(text: string, words: string[]): boolean {
  const t = lc(text);
  return words.some((w) => t.includes(w));
}

function seedFor(ctx: InterviewerContext, salt: string): string {
  return `${ctx.question.title}|${userTurnCount(ctx)}|${ctx.assumptions.length}|${salt}`;
}

// ── Phrase banks ──────────────────────────────────────────────────────────
const OPENING = [
  "Let's structure this before jumping to numbers. What would you anchor your estimate on, and how would you break the problem down?",
  "Good problem to reason through. Where would you start — and how do you want to decompose it?",
  "Before we calculate anything: how would you approach this top-down? What's your starting point?",
];

const PUSH_SEGMENT = [
  "You've anchored on a total — but would everyone use or buy this the same way? How would you segment before going further?",
  "That's a reasonable starting point. Can you segment the population before you proceed? What splits matter here?",
  "Good. Now, is this population homogeneous for this problem, or should you break it into segments first?",
];

/*
 * Renamed from PROBE_FREQUENCY, because it used to announce that frequency was
 * the next step — which is a line of the answer on most market-sizing
 * questions. It now asks what is still missing and lets the candidate name it.
 */
const PROBE_NEXT_ASSUMPTION = [
  "You've segmented well. What else do you need to know about each segment before this becomes a number?",
  "Nice segmentation. Are those segments enough on their own to reach an estimate, or is something still missing?",
  "Good split. What's the next assumption this needs, and where would you get it from?",
];

const CHALLENGE_ASSUMPTION = [
  "Why did you choose that figure? What's the basis for it — can you justify it?",
  "That assumption drives your answer a lot. How confident are you, and how would you sanity-check it?",
  "Where does that number come from? Could it be off by 2x, and would that change your conclusion?",
];

const PUSH_CALC = [
  "You have a structure and assumptions — walk me through the calculation to your final number.",
  "Good foundation. Can you now multiply through and arrive at an estimate? Talk me through it.",
  "Let's see it come together. Compute your estimate step by step from what you've built.",
];

const SANITY_CHECK = [
  "You've reached an estimate. How confident are you? Is there a buyer of this you haven't counted?",
  "Okay, you have a number. Does it pass a sanity check? Is there a segment you've overlooked?",
  "Good — now stress-test it. What would make this too high or too low, and did you round consistently?",
];

const STUCK_NUDGE = [
  "Take a step back. What's the single biggest driver of this number, and can you estimate that first?",
  "Don't worry about precision yet. What's the population or base you're starting from?",
  "Let's simplify. What's the smallest piece of this you could estimate with confidence? Start there and build outward.",
];

const ACK_QUESTION = [
  "Good question — but in an interview you'd have to assume it. What's a reasonable assumption and why?",
  "I'd turn that back to you: what would you assume, and how would you justify it?",
];

// ── Case bank ─────────────────────────────────────────────────────────────
// The banks above are market-sizing specific — they ask for populations and
// frequencies, which is nonsense on "why are margins falling". A case is worked
// in a different order, so the offline interviewer follows that order instead:
// scope, structure, narrow, commit.

const CASE_OPENING = [
  "Before we structure this — what exactly are we solving for, and by when?",
  "Good problem. What's the objective here, and what would success look like for the client?",
  "Let's scope it first. What would you want to know about the business before you break this down?",
];

const CASE_PUSH_STRUCTURE = [
  "That's useful context. How would you break this problem down? I'd like to see the whole space before we go deep.",
  "Okay — give me your structure. What are the two or three buckets that between them cover this?",
  "Before we dig in: what's your framework here, and why those branches?",
];

const CASE_PUSH_MECE = [
  "Those branches overlap a bit — could the same cause sit in two of them? Tighten it up.",
  "Is that structure exhaustive? What's missing from the top level?",
  "Good start on structure. Which of those branches would you look at first, and why that one?",
];

const CASE_PUSH_NARROW = [
  "You've marked where you think the problem is. What's inside that branch — break it one level further.",
  "Fine, so it's in there. Now narrow it: what specifically within that would you check?",
  "You've ruled some things out. What does that leave, and what would you look at next?",
];

const CASE_PUSH_EVIDENCE = [
  "What makes you say that? An interviewer will ask what you've checked before you rule something out.",
  "You've cleared that branch — on what basis? Ask me for what you need.",
  "Careful: that's a claim about the business. What would you want to see before committing to it?",
];

const CASE_PUSH_ANSWER = [
  "You've narrowed it down. So what's your recommendation, and what would you do about it?",
  "Time to commit. What's your answer, and what's the first thing the client should change?",
  "Good — now land it. State your conclusion and the action that follows from it.",
];

const CASE_NO_DATA = [
  "I don't have data on that. Make a reasonable assumption and tell me why it's reasonable.",
  "Nothing on that here — what would you assume, and how would that change your approach?",
];

function markedProblem(ctx: InterviewerContext): boolean {
  return ctx.framework.some((f) => f.status === "problem");
}
function markedAny(ctx: InterviewerContext): boolean {
  return ctx.framework.some((f) => f.status === "problem" || f.status === "healthy");
}

/**
 * The authored fact for whatever the candidate just asked about, if there is
 * one. The case's truth lives in the question row, so the offline interviewer
 * can release data exactly as a real provider would — which is what makes a
 * diagnostic case playable with no API key at all.
 */
function factFor(ctx: InterviewerContext, text: string): string | null {
  const hay = lc(text);
  // Best match, not first match. Topics overlap — "order" appears in both the
  // volume fact and "delivery cost per order" — so returning the first hit
  // answers a question about delivery costs with a fact about order volume.
  // The longest matched topic wins, since a longer term is a more specific one.
  let best: { fact: string; specificity: number } | null = null;
  for (const entry of ctx.dataPack ?? []) {
    for (const topic of entry.topic) {
      const t = lc(topic);
      if (!hay.includes(t)) continue;
      if (!best || t.length > best.specificity) {
        best = { fact: entry.fact, specificity: t.length };
      }
    }
  }
  return best?.fact ?? null;
}

function replyCase(ctx: InterviewerContext): string {
  const turns = userTurnCount(ctx);
  const last = lastUserMessage(ctx);

  if (turns === 0) return pick(CASE_OPENING, seedFor(ctx, "case-open"));
  if (mentions(last, ["stuck", "don't know", "dont know", "no idea", "help", "not sure"])) {
    return pick(CASE_PUSH_STRUCTURE, seedFor(ctx, "case-stuck"));
  }
  // Asked about a branch: state the authored fact and push on. Never more than
  // one, and never a fact that wasn't asked for.
  const fact = factFor(ctx, last);
  if (fact) {
    return `${fact} What does that tell you, and where does it point you next?`;
  }
  // No authored data for it — decline rather than invent, which is the whole
  // reason the facts are authored in the first place.
  if (last.trim().endsWith("?")) {
    return pick(CASE_NO_DATA, seedFor(ctx, "case-nodata"));
  }
  if (ctx.finalAnswer?.trim()) {
    return pick(CASE_PUSH_EVIDENCE, seedFor(ctx, "case-evidence"));
  }
  if (ctx.framework.length === 0) return pick(CASE_PUSH_STRUCTURE, seedFor(ctx, "case-struct"));
  if (ctx.framework.length < 2) return pick(CASE_PUSH_MECE, seedFor(ctx, "case-mece"));
  if (!markedAny(ctx)) return pick(CASE_PUSH_MECE, seedFor(ctx, "case-mece2"));
  if (markedProblem(ctx)) return pick(CASE_PUSH_NARROW, seedFor(ctx, "case-narrow"));
  return pick(CASE_PUSH_ANSWER, seedFor(ctx, "case-answer"));
}

function replyInterviewer(ctx: InterviewerContext): string {
  if (ctx.answerMode === "qualitative") return replyCase(ctx);

  const turns = userTurnCount(ctx);
  const last = lastUserMessage(ctx);

  if (turns === 0 || (!last && ctx.assumptions.length === 0)) {
    return pick(OPENING, seedFor(ctx, "open"));
  }

  // Candidate is stuck / asking
  if (mentions(last, ["stuck", "don't know", "dont know", "no idea", "help", "not sure"])) {
    return pick(STUCK_NUDGE, seedFor(ctx, "stuck"));
  }
  if (last.trim().endsWith("?") || mentions(last, ["what should", "should i", "how do i"])) {
    return pick(ACK_QUESTION, seedFor(ctx, "ackq"));
  }

  // Final estimate present -> sanity check
  if (ctx.finalEstimate != null) {
    return pick(SANITY_CHECK, seedFor(ctx, "sanity"));
  }

  // No segmentation yet -> push segmentation
  if (!hasSegmentation(ctx)) {
    // If they only just mentioned population/total, acknowledge then push
    return pick(PUSH_SEGMENT, seedFor(ctx, "seg"));
  }

  // Has segmentation but few assumptions -> ask what the segments still need
  if (ctx.assumptions.length < 2) {
    return pick(PROBE_NEXT_ASSUMPTION, seedFor(ctx, "freq"));
  }

  // Has structure + assumptions: sometimes challenge an assumption, else push calc
  if (ctx.assumptions.length >= 2 && seededRandom(seedFor(ctx, "branch")) < 0.5) {
    return pick(CHALLENGE_ASSUMPTION, seedFor(ctx, "challenge"));
  }
  return pick(PUSH_CALC, seedFor(ctx, "calc"));
}

function replyTeacher(ctx: InterviewerContext): string {
  const q = ctx.question;
  const approach = q.betterApproach || "Break it down top-down: base population → segment → apply usage/frequency → aggregate.";
  const sample = q.sampleSolution || "";
  return [
    `Here's how a consultant would approach "${q.title}":`,
    "",
    `**Structure.** ${approach}`,
    sample ? `\n**Worked estimate.** ${sample}` : "",
    "\nRemember: the exact number matters less than a clean, defensible structure. Try re-doing it in your own words.",
  ]
    .filter(Boolean)
    .join("\n");
}

function replyEvaluator(ctx: InterviewerContext): string {
  const parts: string[] = [];
  parts.push(
    hasSegmentation(ctx)
      ? "You segmented the problem, which is the backbone of a good answer."
      : "Your biggest gap is segmentation — you jumped toward a number without breaking the population down.",
  );
  parts.push(
    ctx.assumptions.length >= 2
      ? "You stated explicit assumptions, which makes your logic auditable."
      : "Try to state more explicit assumptions so your reasoning can be checked.",
  );
  parts.push("Submit when ready and I'll produce your full scored evaluation.");
  return parts.join(" ");
}

/**
 * The offline debrief coach.
 *
 * Reuses `factFor`'s longest-topic-wins matcher against the scenario's authored
 * coach answers, then falls back to the causal chain. This is what keeps the
 * zero-key promise honest for simulations: with no API key the debrief is still
 * fully authored and still answers the questions candidates actually ask. The
 * LLM only makes it conversational.
 */
function replySimCoach(ctx: InterviewerContext): string {
  const sim = ctx.simulation;
  if (!sim) return "";

  const asked = lastUserMessage(ctx);
  const matched = factFor(ctx, asked);
  if (matched) return matched;

  if (mentions(asked, ["wrong", "miss", "should", "what happened", "why"])) {
    const named = sim.studentDiagnosis.join(", ") || "nothing";
    const truth = sim.trueCauseLabels.join(", ");
    const verdict = sim.trueCauseLabels.some((t) => sim.studentDiagnosis.includes(t))
      ? `You named ${named}, which was right.`
      : `You named ${named}; it was ${truth}.`;
    return `${verdict} ${sim.whereTheLeverageWas} ${sim.causalChain[0] ?? ""}`.trim();
  }

  // Nothing matched: walk the authored chain rather than improvising.
  return `${sim.causalChain.join(" ")} ${sim.whereTheLeverageWas}`.trim();
}

/** The mock's full reply for a context. Synchronous and deterministic. */
export function mockReplyText(ctx: InterviewerContext): string {
  // A finished simulation is a different exercise, not a different mode.
  if (ctx.simulation) return replySimCoach(ctx);

  switch (ctx.mode) {
    case "teacher":
      return replyTeacher(ctx);
    case "evaluator":
      return replyEvaluator(ctx);
    default:
      return replyInterviewer(ctx);
  }
}

/** The mock's hint for a level. Synchronous and deterministic. */
export function mockHintText(ctx: InterviewerContext, level: number): string {
  const q = ctx.question;
  const maxLevel = hintConfig.levels;

  if (ctx.answerMode === "qualitative") {
    if (level <= 1) {
      return pick(
        [
          "Have you scoped it? Before structuring, be clear on the objective, the timeline, and how this business actually makes money.",
          "Start from the whole space, not the first idea. What are the two or three buckets that between them cover this problem?",
          "Ask before you assert — what would you need to know to rule any branch in or out?",
        ],
        seedFor(ctx, "case-hint1"),
      );
    }
    if (level < maxLevel) {
      return pick(
        [
          "Check your top level is exhaustive, then pick the branch you'd investigate first and break it down one more level.",
          "Rule things out explicitly. Clearing a branch is as much progress as flagging one.",
          "Your structure is fine — the insight is a level deeper. What sits inside the branch you're most suspicious of?",
        ],
        seedFor(ctx, "case-hint2"),
      );
    }
    // Still the structure, never which branch holds the problem — that is the
    // thing being graded.
    return `Here's the structure to use: ${q.betterApproach} Work down it one level at a time, ruling branches out as you go — I'll still let you find the cause yourself.`;
  }

  if (level <= 1) {
    return pick(
      [
        "Think about who actually uses or buys this — is the whole population really your market?",
        "Start from a base you know (like a city's population) and narrow it down step by step.",
        "What's the single biggest driver of this number? Estimate that first.",
      ],
      seedFor(ctx, "hint1"),
    );
  }
  if (level < maxLevel) {
    // The DIMENSION, never the splits. "Segment by age" is a hint; "segment
    // into adults and children, then apply a replacement rate" is two steps of
    // the answer.
    return pick(
      [
        "There's one attribute that changes how much of this a person uses. Name it, and let your next split run along it.",
        "Which dimension separates the heavy users from the light ones here? That's the split worth making first.",
        "Your population isn't homogeneous. What's the single characteristic that makes it not homogeneous for this product?",
      ],
      seedFor(ctx, "hint2"),
    );
  }

  /*
   * The last rung, and the one this whole ladder was rebuilt for.
   *
   * It used to be `Here's the structure to use: ${q.betterApproach}` — the
   * authored answer structure, printed verbatim. On a market-sizing question
   * the decomposition IS the answer, so that left the candidate nothing to do
   * but arithmetic, on the rung they had paid the whole ladder of Confidence
   * to reach.
   *
   * What replaces it is the next step for where this candidate actually is,
   * read off the same predicates `replyInterviewer` uses. So the rung still
   * escalates — it is the only one that names a step outright — but it
   * escalates in CONCRETENESS rather than in how much of the chain it gives
   * away, and it never reaches past the step the candidate is stuck before.
   */
  if (ctx.finalEstimate != null) {
    return "You have a number, so the next step is to test it. Take the assumption you were least sure of, halve it, and see whether your conclusion survives.";
  }
  if (!hasSegmentation(ctx)) {
    return "Your next step is the split. Find the one way this population doesn't behave the same for this product, divide on that, and stop there — get the split down before you touch any rates.";
  }
  if (ctx.assumptions.length < 2) {
    return "You have your segments, so the next step is a rate. Take one segment, put a number on how much or how often, and say where that number came from.";
  }
  return "You have segments and you have rates. The next step is to multiply through segment by segment and add them up — do it out loud, so you can see which line ends up dominating.";
}

/**
 * Emit a pre-computed string as deltas.
 *
 * The mock has nothing to wait for, so this adds no artificial delay — it exists
 * so offline dev and the real provider drive the exact same rendering path in the
 * UI, rather than the mock quietly taking a single-shot shortcut that hides
 * streaming bugs until a key is set.
 */
function* chunk(text: string): Generator<string> {
  const WORDS_PER_CHUNK = 6;
  const words = text.split(/(\s+)/).filter(Boolean);
  for (let i = 0; i < words.length; i += WORDS_PER_CHUNK * 2) {
    yield words.slice(i, i + WORDS_PER_CHUNK * 2).join("");
  }
}

export const mockAdapter: LlmAdapter = {
  name: "mock",

  async *reply(ctx) {
    yield* chunk(mockReplyText(ctx));
  },

  async *hint(ctx, level) {
    yield* chunk(mockHintText(ctx, level));
  },
};

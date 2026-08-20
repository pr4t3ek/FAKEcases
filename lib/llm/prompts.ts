import type { AiMode } from "@/lib/config";
import type { InterviewerContext } from "./types";

/**
 * System prompts that enforce interviewer behaviour. Editable content — the
 * single source of truth for how the AI behaves across providers.
 */

export const BASE_INTERVIEWER_RULES = `You are an expert consulting interviewer (McKinsey / BCG / Bain style) running a guesstimate / market-sizing practice session with an MBA candidate in INDIA. All context is Indian (cities, demographics, ₹).

Hard rules:
- NEVER state the final answer early: not the final estimate, not the arithmetic that closes it. Do not solve the problem for the candidate.
- THE DECOMPOSITION IS WHAT IS BEING GRADED, SO IT IS ALSO THE ANSWER. Never propose, name or list the segments to use, the order of the steps, or what to multiply by what — not even as an example, an "if it helps", or a question with the answer inside it ("have you thought about splitting urban vs rural?"). Ask them how they would break it down and react to what they produce. A candidate who has been told the structure has nothing left to be tested on.
- A PUBLIC REFERENCE FIGURE IS NOT THE ANSWER. When the candidate asks for one — a city's population, household size, an urban/rural split — state it from DATA YOU HOLD and then ask what they intend to do with it. They are being tested on structure, not on whether they remember a population, and refusing spends their time on the wrong thing. If the figure is not in DATA YOU HOLD, say you do not have it and ask them to assume one and justify it.
- GIVE THE FIGURE, THEN STOP. Do not follow a number with the step it feeds, the split it enables, or what to multiply it by. "Bangalore is about 1.4 crore. What will you do with that?" is the whole reply.
- When the candidate is stuck, ask a narrowing question — what is the biggest driver, who actually buys this. Never answer the narrowing question for them.
- Ask Socratic questions. Push the candidate to structure, segment (MECE), and justify assumptions.
- Challenge weak or unjustified assumptions. Point out calculation mistakes without giving the number.
- React to the structure they build: say what is missing or overlapping, and recognise a good framework. Naming what is wrong with their segments is fair; naming the segments yourself is not.
- Be encouraging but realistic. One or two crisp questions per turn — do not lecture.
- Keep responses short (2–4 sentences). Use Indian numbering (lakh/crore) where natural.
- Write plain sentences. No LaTeX (\\text, \\times, \\( \\)), no markdown headings or bold. Say arithmetic as words and symbols: "15 crore × 30% = 4.5 crore".`;

export const MODE_PROMPTS: Record<AiMode, string> = {
  interviewer: `${BASE_INTERVIEWER_RULES}\n\nMode: INTERVIEWER. Only ask probing questions and react briefly. A reference figure they asked for is not a hint — give it. Structural help is not yours to give: the candidate has a hint button with escalating levels, and it costs them Confidence. So if they ask how to break the problem down, where to start, or what to segment by, turn the question back and tell them the hint button is there. Answering it here would hand out for free the thing they are graded on.`,
  /*
   * Unreachable from chat: `/api/chat` accepts only `SelectableMode`, which is
   * interviewer and teacher, and `/api/hint` builds its prompt from
   * `hintSystemPrompt` rather than from here. Kept because `coach` is stamped on
   * live `Message` rows every day and `AI_MODES` must keep describing what the
   * database holds — see `lib/config/practice.ts`.
   *
   * Reworded with the rest of this pass rather than left alone. "Nudges toward
   * structure" flatly contradicted the base rules once they banned naming the
   * segments, so a re-enabled Coach would have shipped a prompt arguing with
   * itself. It now says what the middle hint rung says.
   */
  coach: `${BASE_INTERVIEWER_RULES}\n\nMode: COACH. You may name the DIMENSION their next split should use and point at what they have not considered, but never the splits themselves, never more than one step ahead, and never the final answer.`,
  teacher: `You are a consulting teacher helping an MBA candidate in India learn guesstimates. Mode: TEACHER. The candidate has asked for a full explanation. Walk through a clean structured approach step by step (population/segmentation/frequency/quantity), showing the reasoning and a sample estimate. Be clear and educational. Indian context, ₹, lakh/crore.`,
  evaluator: `${BASE_INTERVIEWER_RULES}\n\nMode: EVALUATOR. Summarise what the candidate did well and what to improve, at a high level. Do not produce the formal score (that is generated separately).`,
};

/**
 * A case is a different exercise from a market-sizing question, so the rules
 * change with it: the candidate is structuring and narrowing rather than
 * multiplying, and the interviewer's job is to make them scope the problem, keep
 * their branches mutually exclusive, and commit to a recommendation.
 */
export const BASE_CASE_RULES = `You are an expert consulting interviewer (McKinsey / BCG / Bain style) running a business case practice session with an MBA candidate in INDIA. All context is Indian (companies, consumers, ₹).

Hard rules:
- NEVER reveal the answer, the root cause, or which branch of their framework is the problem. Do not solve the case for the candidate.
- Expect them to scope before structuring. If they jump straight to a framework, ask what the objective is, by when, and how the business makes money.
- Push for structure that is mutually exclusive and collectively exhaustive. Challenge branches that overlap, and ask what a branch is missing.
- When they ask about a specific part of the business, answer with the data you have been given for it and nothing more. If you have no data for it, say so plainly — never invent figures.
- Make them commit: to a hypothesis, to what they would rule out, and finally to a recommendation with a reason.
- Be encouraging but realistic. One or two crisp questions per turn — do not lecture.
- Keep responses short (2–4 sentences). Use Indian numbering (lakh/crore) where natural.
- Write plain sentences. No LaTeX (\\text, \\times, \\( \\)), no markdown headings or bold. Say arithmetic as words and symbols: "15 crore × 30% = 4.5 crore".`;

export const CASE_MODE_PROMPTS: Record<AiMode, string> = {
  interviewer: `${BASE_CASE_RULES}\n\nMode: INTERVIEWER. Only ask probing questions and react briefly. Never give hints unless asked.`,
  coach: `${BASE_CASE_RULES}\n\nMode: COACH. You may nudge them toward a cleaner structure or a branch they've ignored, but never say where the problem is.`,
  teacher: `You are a consulting teacher helping an MBA candidate in India learn case interviews. Mode: TEACHER. The candidate has asked for a full explanation. Walk through how a consultant would structure this case, which branches matter and why, and how they would narrow to a root cause. Be clear and educational. Indian context, ₹, lakh/crore.`,
  evaluator: `${BASE_CASE_RULES}\n\nMode: EVALUATOR. Summarise what the candidate did well and what to improve, at a high level. Do not produce the formal score (that is generated separately).`,
};

export function systemPromptForMode(mode: AiMode, answerMode: "numeric" | "qualitative" = "numeric"): string {
  const table = answerMode === "qualitative" ? CASE_MODE_PROMPTS : MODE_PROMPTS;
  return table[mode] ?? table.interviewer;
}

/**
 * The facts the interviewer is allowed to state, and only when asked about that
 * branch. Handing it the authored data is what stops it inventing a figure that
 * contradicts the sample solution two turns later — the case's truth lives in
 * the question row, not in the model.
 */
/**
 * The debrief coach.
 *
 * The inverse of every other prompt in this file: the run is over, so the cause
 * IS revealed and withholding it would be unhelpful rather than Socratic. What
 * carries over is the ban on invention — the authored figures are the only ones
 * it may use, because a coach that makes up a number is worse than no coach.
 */
/**
 * Who the coach is, when a scenario does not say.
 *
 * The product leader is the historical default and stays the default, so the
 * nine scenarios written before `SimScenario.mentor` existed produce a
 * byte-identical prompt.
 */
export const DEFAULT_SIM_MENTOR = {
  persona: "a senior product leader debriefing a PM candidate",
  audience: "candidate",
} as const;

/**
 * The debrief coach's rules, in the voice the scenario asks for.
 *
 * A function rather than a constant because the persona is scenario content: a
 * cash conversion cycle explained by a "senior product leader" to a "PM
 * candidate" is a small lie the student notices, and the whole exercise is a
 * role-play.
 */
export function simCoachRules(
  mentor: { persona: string; audience: string } = DEFAULT_SIM_MENTOR,
): string {
  return `You are ${mentor.persona} immediately after a decision simulation. The run is FINISHED and scored, and the true cause is stated below.

Rules:
- The exercise is over. Explain plainly — do NOT ask Socratic questions and do NOT withhold the answer.
- Use ONLY the figures and findings given below. Never invent a number, a metric or a fact. If you do not have something, say the simulation doesn't cover it.
- Be specific about what THEIR decision bought and what it cost, using their allocation as given.
- Where the ${mentor.audience} went wrong, say why the evidence pointed elsewhere — not merely that they were wrong.
- Answer as 2–4 short bullets, each starting "- " on its own line. One idea per bullet. No headings, no sub-bullets, no closing paragraph.
- Keep each bullet to one or two short sentences a first-year student would follow. Prefer the everyday word: "money left after costs" beats "contribution", "what it costs to get one customer" beats "CAC". Where a term has to be used, gloss it in the same bullet the first time.
- Write plain sentences. No LaTeX (\\text, \\times, \\( \\)), no markdown headings or bold. Say arithmetic as words and symbols: "15 crore × 30% = 4.5 crore".`;
}

export function renderSimContextBlock(sim: NonNullable<InterviewerContext["simulation"]>): string {
  const allocation = sim.studentAllocation.length
    ? sim.studentAllocation
        .map(
          (a) =>
            `  - ${a.label}: ${a.sprints} sprint(s), ₹${a.rupees.toLocaleString("en-IN")}${a.onTarget ? " (addressed the true cause)" : " (did not address the true cause)"}`,
        )
        .join("\n")
    : "  - nothing funded";

  return [
    `Simulation: ${sim.scenarioTitle} (${sim.company})`,
    `True cause: ${sim.trueCauseLabels.join(", ")}`,
    `What actually happened:\n${sim.causalChain.map((s, i) => `  ${i + 1}. ${s}`).join("\n")}`,
    `Where the leverage was: ${sim.whereTheLeverageWas}`,
    `The candidate named: ${sim.studentDiagnosis.join(", ") || "nothing"}`,
    `The candidate funded:\n${allocation}`,
    `Outcome: ${sim.outcomeSummary}`,
    `Their scores: ${sim.scores.map((s) => `${s.label} ${s.value}`).join(", ")}`,
    `A strong answer sounds like:\n${sim.strongAnswer.map((point) => `  - ${point}`).join("\n")}`,
  ].join("\n\n");
}

/**
 * `withholding` is the interviewer's posture, and it is the wrong one for a
 * teacher.
 *
 * The heading used to be the only one: "state one ONLY when the candidate asks
 * about that topic… never volunteer one unprompted, never reveal the whole
 * list". That is exactly right while the exercise is running, and it contradicts
 * Teacher mode outright — the same prompt tells it to walk through population,
 * segmentation and frequency, which is to say it must volunteer precisely these
 * figures. A model handed both instructions has to pick one, and which one it
 * picks is not a thing to leave to chance.
 *
 * So the two bans are separated. Never inventing a figure always holds, in both
 * headings. Never *volunteering* one holds only while the candidate is still
 * being examined.
 *
 * The caller passes this rather than reading `ctx.mode`, because the war-room
 * coach's context is built with `mode: "teacher"`
 * (`lib/simulation-context.ts`) and sniffing the mode here would change its
 * prompt too.
 */
export function renderDataPack(
  facts: { topic: string[]; fact: string }[],
  { withholding = true }: { withholding?: boolean } = {},
): string {
  if (!facts.length) return "";
  const lines = facts.map((f) => `- [${f.topic.join(", ")}] ${f.fact}`);
  const heading = withholding
    ? "DATA YOU HOLD. State one of these ONLY when the candidate asks about that topic, and quote the figure exactly as written. Never volunteer one unprompted, never reveal the whole list, and never invent a fact that is not here:"
    : "DATA YOU HOLD. Use these freely — they are the figures this walkthrough should be built from. Quote each one exactly as written, prefer them to a number of your own, and never invent a fact that is not here:";
  return [heading, ...lines].join("\n");
}

/**
 * The authored answer, for Teacher mode and nothing else.
 *
 * Teacher mode is the one mode whose job is to work the problem, and until now
 * it was asked to do that with no anchor at all: `sampleSolution`, the ideal
 * range and `betterApproach` all reached `QuestionContext` and none of them
 * reached the prompt. So the model derived a fresh answer every time, and the
 * same question taught a different number on each retry — while the evaluation
 * screen went on showing the one authored figure as "Sample solution". Handing
 * it the stored answer is what makes the lesson stable, and it is the same
 * posture as `renderDataPack`: the question row holds the truth, not the model.
 *
 * **Kept out of `renderContextBlock` on purpose.** That block is shared with
 * `buildHintMessages`, and a hint prompt is explicitly forbidden from stating
 * the final number — a candidate sitting in Teacher mode who then asks for a
 * hint would otherwise have the answer handed to the hint prompt as well. This
 * is appended by `buildReplyMessages` alone, only when the mode is `teacher`,
 * so no other prompt in the app can see it.
 *
 * The instruction travels with the data rather than sitting in `MODE_PROMPTS`,
 * and that is deliberate: `sampleSolution` and `betterApproach` both default to
 * `""` in the schema, so a mode prompt that said "teach toward the reference
 * below" would be promising a block that an unauthored question never produces.
 * Keeping the two together means this is purely additive — a question with
 * nothing authored builds a byte-identical prompt to the one it built before.
 */
export function renderTeacherReference(ctx: InterviewerContext): string {
  const q = ctx.question;
  const numeric = ctx.answerMode !== "qualitative";
  const lines: string[] = [];

  if (q.sampleSolution.trim()) {
    lines.push(
      `- ${numeric ? "Sample solution" : "Sample recommendation"}: ${q.sampleSolution.trim()}`,
    );
  }
  if (numeric && q.idealLow != null && q.idealHigh != null) {
    const unit = q.unit?.trim() ? ` ${q.unit.trim()}` : "";
    lines.push(
      `- Accepted range: ${q.idealLow.toLocaleString("en-IN")} to ${q.idealHigh.toLocaleString("en-IN")}${unit}`,
    );
  }
  if (q.betterApproach.trim()) {
    lines.push(`- The approach to demonstrate: ${q.betterApproach.trim()}`);
  }
  if (!lines.length) return "";

  const close = numeric
    ? "Finish on the sample solution's figure, inside the accepted range where one is given, and choose your intermediate assumptions so the arithmetic reaches it. Never present a different final number."
    : "Close on the sample recommendation. Never land on a different one.";

  return [
    "REFERENCE SOLUTION — the authored answer for this question. It is the same on every retry, so teach toward it rather than deriving a new one, and never say that you were given it:",
    ...lines,
    close,
  ].join("\n");
}

/** Render the structured context into a compact user-visible state block. */
export function renderContextBlock(ctx: InterviewerContext): string {
  const lines: string[] = [];
  lines.push(`QUESTION: ${ctx.question.prompt}`);
  lines.push(
    `Category: ${ctx.question.category} | Difficulty: ${ctx.question.difficulty} | Level: ${ctx.question.interviewLevel}`,
  );
  if (ctx.assumptions.length) {
    lines.push(
      `Candidate assumptions so far: ${ctx.assumptions
        .map((a) => `${a.key}=${a.value}`)
        .join("; ")}`,
    );
  }
  if (ctx.framework.length) {
    // A case tree is several branches with verdicts on them, not one chain, so
    // an arrow-joined list would misrepresent it — and the marks are the most
    // useful thing for the interviewer to react to.
    if (ctx.answerMode === "qualitative") {
      const marked = ctx.framework.map((f) => {
        const verdict =
          f.status === "problem" ? " [candidate says the problem is in here]" :
          f.status === "healthy" ? " [candidate has ruled this out]" : "";
        return `- ${f.label}${verdict}`;
      });
      lines.push(`Candidate framework so far:\n${marked.join("\n")}`);
    } else {
      lines.push(`Candidate framework: ${ctx.framework.map((f) => f.label).join(" → ")}`);
    }
  }
  if (ctx.finalEstimate != null) {
    lines.push(`Candidate current estimate: ${ctx.finalEstimate}`);
  }
  if (ctx.finalAnswer?.trim()) {
    lines.push(`Candidate current recommendation: ${ctx.finalAnswer.trim()}`);
  }
  return lines.join("\n");
}

export function hintSystemPrompt(
  level: number,
  maxLevel: number,
  answerMode: "numeric" | "qualitative" = "numeric",
): string {
  if (answerMode === "qualitative") {
    const intensity =
      level <= 1
        ? "very subtle — point at what they haven't scoped or asked about yet, no specifics"
        : level >= maxLevel
          ? "nearly complete direction — name the part of the framework worth breaking down next, but still never say which branch holds the problem"
          : "more guidance — suggest the next split, or a branch their structure is missing";
    return `${BASE_CASE_RULES}\n\nThe candidate asked for a hint (level ${level} of ${maxLevel}). Give a hint that is ${intensity}. Keep it to 1–3 sentences.`;
  }
  /*
   * One rung, one step. The ladder used to end at "point clearly at the
   * structure to use", which on a market-sizing question IS the answer — the
   * candidate is graded on the decomposition, so handing it over at level 3
   * left nothing but arithmetic. What escalates now is how concrete the SINGLE
   * next step gets, not how much of the chain is revealed.
   */
  const intensity =
    level <= 1
      ? "very subtle — point at what they have not considered yet, and name no step at all"
      : level >= maxLevel
        ? "concrete about ONE step — name the single next step they are stuck before, and stop there. Not the step after it, not the rest of the chain, not the final number"
        : "name the DIMENSION their next split should use — age, geography, income, ownership — without naming the splits themselves or what to do with them afterwards";
  return `${BASE_INTERVIEWER_RULES}\n\nThe candidate asked for a hint (level ${level} of ${maxLevel}). Give a hint that is ${intensity}. Never lay out more than one step ahead, whatever the level. Keep it to 1–3 sentences.`;
}

/**
 * The structure judge.
 *
 * Asked at submit time, and it is the only prompt here that grades rather than
 * teaches. It covers the two things arithmetic cannot check for itself.
 *
 * **The labels.** The deterministic rubric can tell that a tree has figures,
 * real branches and shares that do not exceed their parent. It cannot tell
 * whether those labels decompose *this* question or are six plausible words with
 * numbers attached.
 *
 * **The figures themselves.** `parseNode` can say a value is a number; it has no
 * idea whether 50 is a sensible population or ₹2 a sensible price for a car, and
 * it cannot multiply the chain through to see whether the tree reaches the
 * answer the candidate wrote down. So the model is given every step's value and
 * rate and asked to read them — magnitudes, a child's share against its parent,
 * and whether the arithmetic lands anywhere near the stated result.
 *
 * The hard rule in the prompt — no numbers means no score above the incoherent
 * band — is the one that matters most. A tidy tree of empty labels is an
 * outline, and an outline has not estimated anything.
 *
 * **One line out, deliberately.** The number is the whole product — it scales
 * four categories and nothing else reads the prose — so a long reply would be
 * paid for and discarded. The reason is asked for second because a model that
 * has to name the flaw picks its number more carefully, and because the
 * candidate sees that sentence on the report.
 */
export const FRAMEWORK_JUDGE_RULES = `You are grading a market-sizing answer's framework tree: whether it decomposes the question, AND whether the numbers in it hold up.

Judge these two things together:

1. THE DECOMPOSITION. Do the labels break the question into parts a consultant would use to size it, and is each step a real slice of the one above it?

2. THE NUMBERS. Every step's figure is shown after "=" and its rate after "×". Read them:
   - Is there a figure at all? A tree of labels with no numbers has not estimated anything, however tidy its shape.
   - Is each magnitude plausible for India? A population of 50, a 3000% share, ₹2 for a car, 400 hours in a day — these are wrong on their face.
   - Does a step's figure make sense UNDER ITS PARENT? A child is a slice of its parent, so its share cannot exceed 100%, and sibling shares cannot add to much more than the whole.
   - Multiply the chain through. Does it land anywhere near the candidate's final answer, and is that answer the right order of magnitude for the question? Being out by 10x is a real error; being out by 10000x means the tree and the answer are unrelated.

Score COHERENCE 0-100 on both together:
- 0-29: not an estimate. Placeholder or nonsense labels ("asd", "test", "node 1"); OR no figures anywhere; OR numbers so wrong the tree cannot produce the quantity asked for.
- 30-69: recognisable but flawed. The right general idea with a vague or overlapping split, a missing step, implausible magnitudes, or arithmetic that does not reach the stated answer.
- 70-100: a decomposition a consultant would recognise, with figures that are plausible, consistent with their parents, and that multiply out to roughly the answer given.

HARD RULE: a tree with no numbers in it cannot score above 29, whatever the labels say. Structure without arithmetic is an outline, not an estimate.

A short tree that is correct scores high. Length is not the measure.

Reply with EXACTLY two lines and nothing else:
COHERENCE: <integer 0-100>
REASON: <one sentence, addressed to the candidate, naming the weakest thing about the tree or its numbers>`;

/** The tree and the question, as the judge sees them. */
export function renderJudgeBlock(judge: NonNullable<InterviewerContext["judge"]>): string {
  const lines = judge.nodes.map((n) => {
    const parts = [`${"  ".repeat(n.depth)}- ${n.label.trim() || "(no label)"}`];
    if (n.value?.trim()) parts.push(`= ${n.value.trim()}`);
    if (n.rate?.trim()) parts.push(`× ${n.rate.trim()}`);
    return parts.join(" ");
  });
  const estimate =
    judge.finalEstimate != null
      ? `\nCandidate's final answer: ${judge.finalEstimate.toLocaleString("en-IN")}${judge.unit ? ` ${judge.unit}` : ""}`
      : "";
  return `QUESTION: ${judge.questionPrompt}

THE CANDIDATE'S TREE (indentation is the hierarchy; "=" is a step's value, "×" its rate):
${lines.join("\n") || "  (empty)"}${estimate}`;
}

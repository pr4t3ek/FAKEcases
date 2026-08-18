import type { AiMode } from "@/lib/config";
import type { InterviewerContext } from "./types";

/**
 * System prompts that enforce interviewer behaviour. Editable content — the
 * single source of truth for how the AI behaves across providers.
 */

export const BASE_INTERVIEWER_RULES = `You are an expert consulting interviewer (McKinsey / BCG / Bain style) running a guesstimate / market-sizing practice session with an MBA candidate in INDIA. All context is Indian (cities, demographics, ₹).

Hard rules:
- NEVER reveal or state the final answer early: not the final estimate, not the segmentation that reaches it, not the arithmetic that closes it. Do not solve the problem for the candidate.
- A PUBLIC REFERENCE FIGURE IS NOT THE ANSWER. When the candidate asks for one — a city's population, household size, an urban/rural split — state it from DATA YOU HOLD and then ask what they intend to do with it. They are being tested on structure, not on whether they remember a population, and refusing spends their time on the wrong thing. If the figure is not in DATA YOU HOLD, say you do not have it and ask them to assume one and justify it.
- Ask Socratic questions. Push the candidate to structure, segment (MECE), and justify assumptions.
- Challenge weak or unjustified assumptions. Point out calculation mistakes without giving the number.
- Encourage segmentation and top-down/bottom-up structure. Recognise good frameworks.
- Be encouraging but realistic. One or two crisp questions per turn — do not lecture.
- Keep responses short (2–4 sentences). Use Indian numbering (lakh/crore) where natural.
- Write plain sentences. No LaTeX (\\text, \\times, \\( \\)), no markdown headings or bold. Say arithmetic as words and symbols: "15 crore × 30% = 4.5 crore".`;

export const MODE_PROMPTS: Record<AiMode, string> = {
  interviewer: `${BASE_INTERVIEWER_RULES}\n\nMode: INTERVIEWER. Only ask probing questions and react briefly. Never give hints unless asked — a reference figure they asked for is not a hint.`,
  coach: `${BASE_INTERVIEWER_RULES}\n\nMode: COACH. You may offer gentle hints and nudges toward structure, but still do not reveal the final answer.`,
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
  const intensity =
    level <= 1
      ? "very subtle — just a nudge in the right direction, no specifics"
      : level >= maxLevel
        ? "nearly complete direction — point clearly at the structure to use, but still do not state the final number"
        : "more guidance — suggest the next concrete step or segmentation";
  return `${BASE_INTERVIEWER_RULES}\n\nThe candidate asked for a hint (level ${level} of ${maxLevel}). Give a hint that is ${intensity}. Keep it to 1–3 sentences.`;
}

import type { Question, Category } from "@prisma/client";
import type { QuestionContext } from "@/lib/llm";

/** Map a Prisma question (with category) into the LLM QuestionContext. */
export function toQuestionContext(
  q: Question & { category?: Category | null },
): QuestionContext {
  return {
    title: q.title,
    prompt: q.prompt,
    category: q.category?.name ?? "",
    difficulty: q.difficulty,
    interviewLevel: q.interviewLevel,
    idealLow: q.idealLow,
    idealHigh: q.idealHigh,
    unit: q.unit,
    betterApproach: q.betterApproach,
    sampleSolution: q.sampleSolution,
  };
}

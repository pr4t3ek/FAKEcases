import { GoogleGenAI } from "@google/genai";
import { env } from "@/lib/config";
import { buildReplyMessages, buildHintMessages } from "./build-messages";
import { classifyGeminiError, LlmError } from "./errors";
import type { ConvMessage, InterviewerContext, LlmAdapter } from "./types";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

/**
 * Teacher mode writes a full structured walkthrough; 512 (what the older
 * adapters used) truncates it mid-sentence.
 */
const MAX_OUTPUT_TOKENS = 1024;

/**
 * Synthetic opener used when the stored history starts with an assistant turn.
 *
 * That happens on every attempt, because `startAttempt()` seeds the interviewer's
 * opening question before the candidate has said anything. Gemini requires the
 * conversation to begin with a `user` turn, and dropping the seeded opener instead
 * would hide the interviewer's own question from it.
 */
const SESSION_OPENER = "(The candidate has just opened this practice question.)";

/** Gemini's `Content` shape, narrowed to the text-only subset this app uses. */
export interface GeminiContent {
  role: "user" | "model";
  parts: { text: string }[];
}

/**
 * Map `ConvMessage[]` onto Gemini's `contents`.
 *
 * Three contract differences from the OpenAI/Anthropic shape make this more than
 * a rename, and all three are silent failures rather than type errors:
 *   - Gemini's assistant role is `model`, not `assistant`.
 *   - The system prompt travels in `config.systemInstruction`, never in `contents`.
 *   - Turns must alternate and must open with `user`. `buildHintMessages()` appends
 *     a user turn to history that may already end in one, so consecutive same-role
 *     turns are merged rather than passed through.
 *
 * Exported separately from the network call so it can be unit-tested offline.
 */
export function toGeminiContents(messages: ConvMessage[]): GeminiContent[] {
  const contents: GeminiContent[] = [];

  for (const message of messages) {
    if (message.role === "system") continue;

    const text = message.content?.trim();
    if (!text) continue;

    const role = message.role === "assistant" ? "model" : "user";
    const previous = contents[contents.length - 1];

    if (previous && previous.role === role) {
      previous.parts[0].text += `\n\n${text}`;
      continue;
    }
    contents.push({ role, parts: [{ text }] });
  }

  if (contents.length === 0) {
    return [{ role: "user", parts: [{ text: SESSION_OPENER }] }];
  }
  if (contents[0].role === "model") {
    contents.unshift({ role: "user", parts: [{ text: SESSION_OPENER }] });
  }

  return contents;
}

function resolveModel(): string {
  return env.llm.model?.trim() || DEFAULT_GEMINI_MODEL;
}

/**
 * Thinking is on by default on Gemini 2.5 models and is billed against
 * `maxOutputTokens` — long enough reasoning returns an empty visible answer.
 * The interviewer's turns are short Socratic questions where reasoning buys
 * little, and disabling it also stretches the free tier's shared token budget.
 *
 * Pro models don't allow thinking to be switched off, so leave their default alone.
 */
function thinkingConfigFor(model: string): { thinkingBudget: number } | undefined {
  return /-pro\b/.test(model) ? undefined : { thinkingBudget: 0 };
}

async function* run(system: string, messages: ConvMessage[]): AsyncGenerator<string> {
  const apiKey = env.llm.geminiApiKey;
  if (!apiKey) {
    throw new LlmError("provider_error", "GEMINI_API_KEY not set");
  }

  const model = resolveModel();
  const ai = new GoogleGenAI({ apiKey });

  try {
    const stream = await ai.models.generateContentStream({
      model,
      contents: toGeminiContents(messages),
      config: {
        systemInstruction: system,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        thinkingConfig: thinkingConfigFor(model),
      },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) yield text;
    }
  } catch (err) {
    throw classifyGeminiError(err);
  }
}

export const geminiAdapter: LlmAdapter = {
  name: "gemini",
  get model() {
    return resolveModel();
  },
  reply(ctx: InterviewerContext) {
    const { system, messages } = buildReplyMessages(ctx);
    return run(system, messages);
  },
  hint(ctx: InterviewerContext, level: number) {
    const { system, messages } = buildHintMessages(ctx, level);
    return run(system, messages);
  },
};

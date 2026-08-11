/** Practice-experience tunables: hints, panel layout defaults. */

export const hintConfig = {
  /** Number of escalating hint levels before the AI may fully explain. */
  levels: 3,
};

/*
 * The guest caps that used to live here — three submitted attempts, one
 * simulation run — are gone. What a guest may reach is now a property of the
 * content (`Question.freeTier`) rather than a running total, and resolved by
 * `lib/entitlements.ts` against the tier table in `./access.ts`.
 *
 * Keeping both would have meant two walls with two different messages: a guest
 * could be turned away from a question they had never opened, or from one they
 * had already been given. Replaying the free sample as often as you like costs
 * nothing worth metering — the reason to sign up is the other thirty items, not
 * a play counter.
 */

/**
 * LLM spend guards.
 *
 * Free-tier quotas are per API key and therefore shared by every user of the
 * deployment, not per user. Without a per-user cap one enthusiastic candidate can
 * consume the whole day's budget; without a global cap the app discovers the
 * ceiling by taking 429s. Both limits degrade to the mock interviewer rather than
 * erroring — see `lib/llm/budget.ts`.
 *
 * `globalRequestsPerDay` is deliberately set below the model's real RPD so there
 * is headroom left for the seeded opening turns that bypass the chat routes.
 * Gemini free tier at the time of writing: 250 RPD on gemini-2.5-flash, 1,000 on
 * gemini-2.5-flash-lite. Raise this if you move to a paid tier or a lighter model.
 */
export const llmBudget = {
  /** Per-user rolling-window cap. */
  userMessagesPerHour: 40,
  /** Deployment-wide daily cap on real provider calls (UTC days). */
  globalRequestsPerDay: 200,
};

/**
 * Voice input for the chat composer.
 *
 * `NEXT_PUBLIC_` because the recogniser is chosen in the browser — a server-only
 * variable reads as `undefined` there and would silently fall back to the default
 * rather than failing visibly.
 */
export const speechConfig = {
  /** Which `SpeechRecogniser` to use. Only "browser" exists today. */
  provider: process.env.NEXT_PUBLIC_SPEECH_PROVIDER ?? "browser",
  /**
   * Indian English, and not cosmetic: every seeded question is India-focused, and
   * en-US transcribes "two lakh" as "two lack" and mangles Indian place names.
   */
  lang: "en-IN",
};

/** Default practice-screen panel widths (percent). User-resizable + persisted. */
export const panelDefaults = {
  left: 40,
  center: 40,
  right: 20,
  minLeftPx: 280,
  minRightPx: 260,
  /** Left auto-expands to this when the framework builder is the active tool. */
  frameworkExpandLeft: 50,
};

/**
 * Both modes give the tree the right-hand column's space.
 *
 * That column carries three things, and none of them earns the width once the
 * tree is a diagram. The framework summary is a read-only mirror of the tree
 * being edited two panels away. The answer box moves under the tree. And the
 * calculations list is either dead (a case has no calculator) or already
 * somewhere better — on a guesstimate it is in the draggable calculator popup,
 * which travels with you instead of sitting in a fixed column.
 *
 * Collapsed rather than removed: the resize handle brings the summary back for
 * anyone who wants it.
 */
export const treeFirstPanelDefaults = {
  left: 64,
  center: 36,
  right: 0,
};

/**
 * Every mode a `Message.mode` or `Attempt.mode` can hold.
 *
 * Wider than what the picker offers, and has to stay that way: `coach` is what
 * `/api/hint` stamps on a hint turn, so it is written on live rows every day,
 * and both it and `evaluator` sit on attempts recorded while they were still
 * offered. The type describes what is in the database, not what is on screen.
 */
export const AI_MODES = ["interviewer", "coach", "teacher", "evaluator"] as const;
export type AiMode = (typeof AI_MODES)[number];

/**
 * The modes a candidate chooses between.
 *
 * Two, deliberately. Coach and Evaluator were a menu of things the app already
 * does better elsewhere: hints have their own button, their own escalating
 * ladder and their own price in Confidence, and the evaluation is a scored
 * report generated at submit rather than a chat turn asked for by hand. Offering
 * them as conversation modes gave two routes to the same place, one of them
 * untracked — Coach in particular handed out hints without touching `hintsUsed`.
 *
 * The real choice is the one that costs something: be interviewed, or be told.
 */
export const aiModes = [
  { key: "interviewer", label: "Interviewer", hint: "Only asks questions" },
  { key: "teacher", label: "Teacher", hint: "Explains the solution" },
] as const satisfies readonly { key: AiMode; label: string; hint: string }[];

export type SelectableMode = (typeof aiModes)[number]["key"];

/**
 * The mode to *show* for a stored one.
 *
 * An attempt left mid-session on a mode that is no longer offered would
 * otherwise render a picker with nothing selected, and send a mode the chat
 * route now refuses. Falling back to the interviewer is the honest default: it
 * is the one that reveals nothing.
 */
export function selectableMode(mode: string | null | undefined): SelectableMode {
  return aiModes.some((m) => m.key === mode) ? (mode as SelectableMode) : "interviewer";
}

/** Practice-experience tunables: hints, guest caps, panel layout defaults. */

export const hintConfig = {
  /** Number of escalating hint levels before the AI may fully explain. */
  levels: 3,
};

export const guestConfig = {
  /** Attempts a guest may complete before the sign-up soft wall. */
  attemptCap: 3,
  /**
   * Simulations a guest may complete, counted separately.
   *
   * A run is a far larger unit of work than an attempt — a dashboard, a
   * budgeted investigation and a scored decision — so sharing `attemptCap`
   * would either make three runs free or make one attempt cost a third of the
   * war room. One full run is enough to show what the format is.
   */
  simRunCap: 1,
};

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

export const aiModes = [
  { key: "interviewer", label: "Interviewer", hint: "Only asks questions" },
  { key: "coach", label: "Coach", hint: "Provides hints" },
  { key: "teacher", label: "Teacher", hint: "Explains the solution" },
  { key: "evaluator", label: "Evaluator", hint: "Grades performance" },
] as const;

export type AiMode = (typeof aiModes)[number]["key"];

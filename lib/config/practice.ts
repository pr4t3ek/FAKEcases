/** Practice-experience tunables: hints, guest caps, panel layout defaults. */

export const hintConfig = {
  /** Number of escalating hint levels before the AI may fully explain. */
  levels: 3,
};

export const guestConfig = {
  /** Attempts a guest may complete before the sign-up soft wall. */
  attemptCap: 3,
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

export const aiModes = [
  { key: "interviewer", label: "Interviewer", hint: "Only asks questions" },
  { key: "coach", label: "Coach", hint: "Provides hints" },
  { key: "teacher", label: "Teacher", hint: "Explains the solution" },
  { key: "evaluator", label: "Evaluator", hint: "Grades performance" },
] as const;

export type AiMode = (typeof aiModes)[number]["key"];

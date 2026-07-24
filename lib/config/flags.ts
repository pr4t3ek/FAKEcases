/**
 * Feature flags. Toggle whole features on/off without removing code.
 * Kept intentionally simple (static) — could be made per-user/remote later.
 */
export const flags = {
  gamification: true,
  rankLadder: true,
  leaderboard: false, // deferred
  dailyChallenge: false, // deferred
  voiceMode: false, // deferred
  whiteboard: false, // deferred
  caseInterviews: false, // Phase 2
  pdfExport: true,
  guestMode: true,
} as const;

export type FeatureFlag = keyof typeof flags;

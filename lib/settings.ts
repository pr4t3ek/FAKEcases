import { db } from "@/lib/db";
import { llmBudget } from "@/lib/config";

/**
 * Values an admin can retune without a deploy.
 *
 * The same arrangement `SimScenarioOverride` uses, and for the same reason: the
 * shipped value lives in code, a row in `AppSetting` overrides it, and an EMPTY
 * TABLE IS A WORKING APP. That ordering is what makes a launch safe — the
 * deployment runs on the defaults until somebody deliberately changes one — and
 * what makes a bad edit recoverable by deleting a row rather than by shipping.
 *
 * Only the turn budgets are exposed today. They are here rather than in
 * `lib/config/practice.ts` alone because they are the numbers a professor has to
 * be able to move mid-term, when a class turns out to need more room than the
 * default allowed and the alternative is a redeploy between lectures.
 */

/** The tunable keys, and the code default each falls back to. */
export const SETTING_DEFAULTS = {
  messagesPerAttempt: llmBudget.messagesPerAttempt,
  messagesPerMinute: llmBudget.messagesPerMinute,
  userMessagesPerHour: llmBudget.userMessagesPerHour,
  globalRequestsPerDay: llmBudget.globalRequestsPerDay,
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type Settings = Record<SettingKey, number>;

export const SETTING_KEYS = Object.keys(SETTING_DEFAULTS) as SettingKey[];

/**
 * Every tunable, with overrides applied.
 *
 * One query for all of them rather than one per key: the caller that wants a
 * limit usually wants to check two, and a settings read on the hot path of every
 * chat turn should not be several round trips.
 *
 * A row that will not parse is IGNORED rather than thrown on. A typo in an admin
 * field must not take the interviewer down — falling back to the shipped value
 * is both the safe direction and the recoverable one.
 */
export async function loadSettings(): Promise<Settings> {
  const rows = await db.appSetting.findMany({
    where: { key: { in: SETTING_KEYS } },
    select: { key: true, value: true },
  });

  const settings = { ...SETTING_DEFAULTS } as Settings;
  for (const row of rows) {
    const parsed = Number(row.value);
    // `Number("")` is 0, which is a legal value for globalRequestsPerDay, so the
    // blank string has to be rejected explicitly rather than by falsiness.
    if (row.value.trim() === "" || !Number.isFinite(parsed) || parsed < 0) continue;
    settings[row.key as SettingKey] = Math.floor(parsed);
  }
  return settings;
}

/** Write one override. Validation lives at the action, which can report it. */
export async function saveSetting(key: SettingKey, value: number): Promise<void> {
  await db.appSetting.upsert({
    where: { key },
    create: { key, value: String(value) },
    update: { value: String(value) },
  });
}

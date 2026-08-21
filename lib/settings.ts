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
 * Two kinds live here. The turn budgets are the numbers a professor has to be
 * able to move mid-term, when a class turns out to need more room than the
 * default allowed and the alternative is a redeploy between lectures. The text
 * settings are the strings a deployment has to be able to correct without one —
 * today that is the address `/forgot-password` tells people to write to, which
 * is a real person's mailbox and so will eventually change hands.
 *
 * Both sit in the same `AppSetting` table, whose `value` is a String column
 * precisely so a non-numeric setting would not need a migration. The two key
 * maps must not overlap; `SETTING_KEYS` and `TEXT_SETTING_KEYS` are asserted
 * disjoint in the tests rather than left to whoever adds the third one.
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

// ── Text settings ───────────────────────────────────────────────────────────

/**
 * Strings an admin can change without a deploy.
 *
 * `adminContactEmail` is the address `/forgot-password` tells a locked-out
 * student to write to. It is shipped with a working value so a fresh clone's
 * reset instructions are never blank, and it is a setting rather than a constant
 * because it is a person's mailbox: whoever administers the launch is not
 * necessarily whoever administers it next term, and that change should be a
 * field in the admin panel rather than a pull request.
 */
export const TEXT_SETTING_DEFAULTS = {
  adminContactEmail: "anhxyamraj@gmail.com",
  /**
   * `Question.externalId` of the guesstimate a first-timer is walked through.
   *
   * A setting rather than a constant because which example teaches best is a
   * judgement that will change — and because it must be possible to point it at
   * a different question, or at one with no published walkthrough (which simply
   * turns the feature off), without a deploy.
   *
   * Deliberately NOT the question the student opened: walking them through
   * their own would hand them its answer, and the repo's rule for that is that
   * the attempt then scores null. A separate demo keeps their real attempt
   * fully scored.
   */
  walkthroughDemoQuestion: "chai-bangalore-daily",
} as const;

export type TextSettingKey = keyof typeof TEXT_SETTING_DEFAULTS;
export type TextSettings = Record<TextSettingKey, string>;

export const TEXT_SETTING_KEYS = Object.keys(TEXT_SETTING_DEFAULTS) as TextSettingKey[];

/**
 * Every text tunable, with overrides applied.
 *
 * A blank row is IGNORED rather than served, for the same reason a bad number is
 * in `loadSettings`: an empty contact address turns the reset instructions into
 * a sentence with a hole in it, and the shipped value is both the safe direction
 * and the recoverable one.
 */
export async function loadTextSettings(): Promise<TextSettings> {
  const rows = await db.appSetting.findMany({
    where: { key: { in: TEXT_SETTING_KEYS } },
    select: { key: true, value: true },
  });

  const settings = { ...TEXT_SETTING_DEFAULTS } as TextSettings;
  for (const row of rows) {
    const value = row.value.trim();
    if (!value) continue;
    settings[row.key as TextSettingKey] = value;
  }
  return settings;
}

/** Write one text override. Validation lives at the action, which can report it. */
export async function saveTextSetting(key: TextSettingKey, value: string): Promise<void> {
  const trimmed = value.trim();
  await db.appSetting.upsert({
    where: { key },
    create: { key, value: trimmed },
    update: { value: trimmed },
  });
}

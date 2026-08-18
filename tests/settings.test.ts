import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Admin-editable limits.
 *
 * The property worth protecting is the ordering: code holds the shipped value, a
 * row overrides it, and an EMPTY TABLE IS A WORKING APP. That last one is what
 * makes a launch safe, so it is the first case here.
 *
 * The other half is that a bad row must not take the interviewer down. These
 * numbers are typed into a form by a professor between lectures; a stray letter
 * should cost them the override, not the class.
 */
const settingFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  db: { appSetting: { findMany: settingFindMany, upsert: vi.fn() } },
}));

const { loadSettings, SETTING_DEFAULTS } = await import("@/lib/settings");

describe("loadSettings", () => {
  beforeEach(() => settingFindMany.mockReset().mockResolvedValue([]));

  it("falls back to the shipped defaults when nothing is overridden", async () => {
    expect(await loadSettings()).toEqual(SETTING_DEFAULTS);
  });

  it("lets a row override one value and leaves the rest alone", async () => {
    settingFindMany.mockResolvedValue([{ key: "messagesPerAttempt", value: "25" }]);

    const s = await loadSettings();
    expect(s.messagesPerAttempt).toBe(25);
    expect(s.messagesPerMinute).toBe(SETTING_DEFAULTS.messagesPerMinute);
  });

  /** 0 means "no limit" throughout, so it has to survive as a real value. */
  it("keeps a zero rather than treating it as unset", async () => {
    settingFindMany.mockResolvedValue([{ key: "messagesPerAttempt", value: "0" }]);
    expect((await loadSettings()).messagesPerAttempt).toBe(0);
  });

  it("ignores a row that will not parse", async () => {
    settingFindMany.mockResolvedValue([{ key: "messagesPerAttempt", value: "ten" }]);
    expect((await loadSettings()).messagesPerAttempt).toBe(SETTING_DEFAULTS.messagesPerAttempt);
  });

  /**
   * `Number("")` is 0, and 0 disables a limit — so an empty field would silently
   * switch one off rather than being ignored. Rejected explicitly for that reason.
   */
  it("ignores an empty string rather than reading it as zero", async () => {
    settingFindMany.mockResolvedValue([{ key: "messagesPerAttempt", value: "  " }]);
    expect((await loadSettings()).messagesPerAttempt).toBe(SETTING_DEFAULTS.messagesPerAttempt);
  });

  it("ignores a negative value", async () => {
    settingFindMany.mockResolvedValue([{ key: "messagesPerMinute", value: "-5" }]);
    expect((await loadSettings()).messagesPerMinute).toBe(SETTING_DEFAULTS.messagesPerMinute);
  });

  it("floors a fractional value rather than passing it to a query", async () => {
    settingFindMany.mockResolvedValue([{ key: "messagesPerMinute", value: "3.7" }]);
    expect((await loadSettings()).messagesPerMinute).toBe(3);
  });

  /** The global cap ships off; that is a deliberate launch decision, not an oversight. */
  it("ships the deployment-wide cap disabled", () => {
    expect(SETTING_DEFAULTS.globalRequestsPerDay).toBe(0);
  });
});

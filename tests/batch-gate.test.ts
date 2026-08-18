import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * The gate's whole job is deciding *who* is sent to `/welcome`, so the redirect
 * itself is stubbed and the decision is what gets asserted. `server-only` is
 * stubbed for the reason `lib/daily-unlock.ts` avoids importing it: the marker
 * is unresolvable under Vitest.
 */
const redirect = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));

const { requireBatch } = await import("@/lib/batch-gate");

beforeEach(() => redirect.mockClear());

const account = (over: { isGuest?: boolean; batch?: string | null } = {}) => ({
  isGuest: false,
  batch: null,
  ...over,
});

describe("requireBatch", () => {
  it("sends an account with no batch to the step that asks for one", () => {
    requireBatch(account());
    expect(redirect).toHaveBeenCalledWith("/welcome");
  });

  it("lets an account that has answered straight through", () => {
    requireBatch(account({ batch: "pgp1" }));
    expect(redirect).not.toHaveBeenCalled();
  });

  /**
   * The exemption a classroom depends on. A class joins a room as guests by
   * design, so gating them would break `/join` and `/room/[code]` outright —
   * and a guest is filtered out of every board anyway, so there is no label
   * here worth collecting yet. They are asked at signup instead.
   */
  it("never gates a guest, even with no batch", () => {
    requireBatch(account({ isGuest: true }));
    expect(redirect).not.toHaveBeenCalled();
  });

  it("treats an empty string as unanswered, not as an answer", () => {
    // A `<select>` posts "" for its placeholder, and a write path that skipped
    // validation could store it. Falsy is the honest reading.
    requireBatch(account({ batch: "" }));
    expect(redirect).toHaveBeenCalledWith("/welcome");
  });
});

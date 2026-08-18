import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * A sibling of `tests/batch-gate.test.ts`, and the contrast between the two is
 * the point: this gate is deliberately the wider one.
 */
const redirect = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));

const { requirePasswordChange } = await import("@/lib/password-gate");

beforeEach(() => redirect.mockClear());

const account = (over: { isGuest?: boolean; mustChangePassword?: boolean } = {}) => ({
  isGuest: false,
  mustChangePassword: false,
  ...over,
});

describe("requirePasswordChange", () => {
  it("sends an account whose password was reset to the page that replaces it", () => {
    requirePasswordChange(account({ mustChangePassword: true }));
    expect(redirect).toHaveBeenCalledWith("/set-password");
  });

  it("lets everyone else straight through", () => {
    requirePasswordChange(account());
    expect(redirect).not.toHaveBeenCalled();
  });

  /**
   * A guest has no password to reset, so the flag can never be set on one. The
   * exemption is here for the same reason it is on the batch gate: a class joins
   * a classroom room as guests, and a gate that caught them would break `/join`.
   */
  it("never gates a guest", () => {
    requirePasswordChange(account({ isGuest: true, mustChangePassword: true }));
    expect(redirect).not.toHaveBeenCalled();
  });
});

import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/config";
import { hashPassword, verifyPassword } from "@/lib/password";
import type { User } from "@prisma/client";

const COOKIE_NAME = "eq_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function sign(userId: string): string {
  const payload = `${userId}.${Date.now()}`;
  const sig = createHmac("sha256", env.authSecret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function verify(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, ts, sig] = parts;
  const expected = createHmac("sha256", env.authSecret).update(`${userId}.${ts}`).digest("hex");
  try {
    if (
      sig.length === expected.length &&
      timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    ) {
      return userId;
    }
  } catch {
    /* fallthrough */
  }
  return null;
}

/** Read the current user from the session cookie (RSC-safe, read-only). */
export async function getSessionUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const userId = verify(token);
  if (!userId) return null;
  return db.user.findUnique({ where: { id: userId } });
}

/** Set the session cookie (call from a Server Action or Route Handler). */
export async function setSession(userId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, sign(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProd,
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Get the current user or create a guest (call from Action/Route — sets cookie). */
export async function getOrCreateGuest(): Promise<User> {
  const existing = await getSessionUser();
  if (existing) return existing;
  const guest = await db.user.create({
    data: { isGuest: true, name: "Guest" },
  });
  await setSession(guest.id);
  return guest;
}

export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") redirect("/login");
  return user;
}

// ── Credential auth ─────────────────────────────────────────────────────────

export interface AuthOutcome {
  ok: boolean;
  error?: string;
}

/**
 * Sign up. If the current session is a guest, upgrade that same row in place —
 * so all guest attempts/history are preserved automatically (claim-on-signup).
 */
export async function signup(
  email: string,
  password: string,
  name: string,
): Promise<AuthOutcome> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !password || password.length < 6) {
    return { ok: false, error: "Enter a valid email and a password of at least 6 characters." };
  }
  const taken = await db.user.findUnique({ where: { email: normalized } });
  if (taken) return { ok: false, error: "An account with that email already exists." };

  const current = await getSessionUser();
  const passwordHash = hashPassword(password);

  if (current && current.isGuest) {
    await db.user.update({
      where: { id: current.id },
      data: { email: normalized, name: name.trim() || "Learner", passwordHash, isGuest: false },
    });
    await setSession(current.id);
    return { ok: true };
  }

  const user = await db.user.create({
    data: { email: normalized, name: name.trim() || "Learner", passwordHash },
  });
  await setSession(user.id);
  return { ok: true };
}

export async function login(email: string, password: string): Promise<AuthOutcome> {
  const normalized = email.trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email: normalized } });
  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return { ok: false, error: "Invalid email or password." };
  }

  // If a guest session with attempts exists, migrate them to this account.
  const current = await getSessionUser();
  if (current && current.isGuest && current.id !== user.id) {
    await db.attempt.updateMany({ where: { userId: current.id }, data: { userId: user.id } });
    await db.user.delete({ where: { id: current.id } }).catch(() => {});
  }

  await setSession(user.id);
  return { ok: true };
}

import { db } from "@/lib/db";
import { env, isKeyedProvider, KEYED_PROVIDERS, type KeyedProvider, type LlmProvider } from "@/lib/config";
import { decryptSecret, hasStrongAuthSecret, maskKey } from "./crypto";
import { dayKey } from "./budget";

/**
 * Which keys a provider may try, in order.
 *
 * The app has always had a fallback chain between PROVIDERS. This is the same
 * idea one level down, and it exists because of how the free tier is metered:
 * Gemini's ceiling is per key and shared by every user of the deployment, so a
 * cohort practising on one key exhausts it mid-afternoon and everybody after
 * that gets the offline mock. Three keys is three times the afternoon.
 *
 * Two sources, and the order between them is the point:
 *
 *   1. **`LlmApiKey` rows**, edited at `/admin`, encrypted at rest.
 *   2. **Numbered environment variables** — `GEMINI_API_KEY`, `_2`, `_3`, …
 *
 * Rows OVERRIDE the environment rather than merging with it. Merging reads as
 * the friendlier choice and is the wrong one: an admin who removes a key from
 * the panel has said to stop using it, and a merge would keep sending turns to
 * whatever `.env` still holds — the failure mode being a key you believe you
 * revoked continuing to spend.
 */

/** One usable key, whichever layer it came from. */
export interface ResolvedKey {
  /** `LlmApiKey.id` for a stored key; `env:<provider>:<slot>` for an environment one. */
  id: string;
  /** Never logged, never rendered, never sent to a client. */
  secret: string;
  /** Masked form, safe to display and to log. */
  hint: string;
  source: "env" | "db";
}

/** What the admin panel is allowed to see: everything except the key itself. */
export interface KeyStatus {
  id: string;
  provider: KeyedProvider;
  hint: string;
  order: number;
  source: "env" | "db";
  /** True when this key reported an exhausted quota today. Lapses at UTC midnight. */
  spent: boolean;
  disabled: boolean;
  lastError: string | null;
}

/**
 * Rows are cached briefly because `listKeys` runs on the hot path of every chat
 * turn and the answer changes about twice a term. Short enough that an admin who
 * pastes a key and starts a practice attempt sees it used; the admin actions
 * clear it outright so they do not have to wait even that long.
 */
const CACHE_TTL_MS = 30_000;

interface CacheEntry {
  rows: DbKeyRow[];
  at: number;
}

interface DbKeyRow {
  id: string;
  hint: string;
  secret: string;
  order: number;
  spentOn: string | null;
  disabled: boolean;
  lastError: string | null;
}

const cache = new Map<KeyedProvider, CacheEntry>();

export function clearKeyCache(): void {
  cache.clear();
}

/**
 * Whether stored keys are usable at all.
 *
 * `AUTH_SECRET` is what the ciphertext in `LlmApiKey.secret` is encrypted under,
 * so without a real one there is nothing to read and no point asking the
 * database. That makes this both the security gate and the reason a fresh clone
 * — which has no `AUTH_SECRET` and no rows — never opens a connection here.
 */
export function canUseStoredKeys(): boolean {
  return hasStrongAuthSecret();
}

async function loadRows(provider: KeyedProvider): Promise<DbKeyRow[]> {
  const hit = cache.get(provider);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.rows;

  const rows = await db.llmApiKey.findMany({
    where: { provider },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      hint: true,
      secret: true,
      order: true,
      spentOn: true,
      disabled: true,
      lastError: true,
    },
  });

  cache.set(provider, { rows, at: Date.now() });
  return rows;
}

function envKeys(provider: KeyedProvider): ResolvedKey[] {
  return env.llm.apiKeys[provider].map((secret, i) => ({
    id: `env:${provider}:${i + 1}`,
    secret,
    hint: maskKey(secret),
    source: "env" as const,
  }));
}

/**
 * The keys to try for this provider, best first.
 *
 * Filtered on read rather than cached filtered, so a rotation whose keys were
 * all spent yesterday comes back by itself when the UTC day turns over — no
 * eviction, no scheduled job, no admin having to remember.
 *
 * A row whose ciphertext will not decrypt is DROPPED rather than thrown on,
 * which is `loadSettings`'s rule for a malformed row and right for the same
 * reason: one key written under a previous `AUTH_SECRET` must not take the other
 * two down with it.
 */
export async function listKeys(
  provider: LlmProvider,
  now: Date = new Date(),
): Promise<ResolvedKey[]> {
  if (!isKeyedProvider(provider)) return [];
  if (!canUseStoredKeys()) return envKeys(provider);

  const rows = await loadRows(provider);
  if (rows.length === 0) return envKeys(provider);

  const today = dayKey(now);
  const usable: ResolvedKey[] = [];

  for (const row of rows) {
    if (row.disabled || row.spentOn === today) continue;
    const secret = decryptSecret(row.secret);
    if (!secret) {
      console.error(`[llm] ${provider} key ${row.hint} could not be decrypted — skipping it.`);
      continue;
    }
    usable.push({ id: row.id, secret, hint: row.hint, source: "db" });
  }

  return usable;
}

/**
 * Note that a key's quota is gone for the day.
 *
 * Persisted rather than remembered in-process because this deploys to Vercel,
 * where a request lands on one of many short-lived instances: an in-memory
 * marker would leave nearly every instance to rediscover the same dead key, at
 * one wasted turn each.
 *
 * Environment keys have no row to write, so they are skipped — which is the
 * honest cost of the bootstrap layer, and the reason `/admin` is the better home
 * for a rotation you intend to lean on.
 */
export async function markSpent(key: ResolvedKey, now: Date = new Date()): Promise<void> {
  if (key.source !== "db") return;
  try {
    await db.llmApiKey.update({ where: { id: key.id }, data: { spentOn: dayKey(now) } });
    cache.clear();
  } catch (err) {
    // Best-effort, like `recordLlmCall`: a bookkeeping write must never fail a
    // turn the student already received. Worst case the key is retried once more.
    console.error("[llm] failed to mark key spent:", err);
  }
}

/**
 * Retire a key the provider rejected outright (401/403).
 *
 * Unlike `markSpent` this does not lapse: a revoked key does not start working
 * again at midnight, and quietly retrying it every day would bury the one thing
 * an admin needs to see. `lastError` carries the provider's own words to the
 * panel so it can name the fix rather than the symptom.
 */
export async function markDisabled(key: ResolvedKey, reason: string): Promise<void> {
  if (key.source !== "db") return;
  try {
    await db.llmApiKey.update({
      where: { id: key.id },
      data: { disabled: true, lastError: reason.slice(0, 500) },
    });
    cache.clear();
  } catch (err) {
    console.error("[llm] failed to disable key:", err);
  }
}

/**
 * Every key on the deployment, masked, for the admin panel.
 *
 * Deliberately shows what `listKeys` filters out — spent and disabled keys are
 * exactly what an admin has opened the page to deal with. Environment keys are
 * included and marked as such, so a rotation split across both layers reads as
 * one list rather than as a panel that is missing keys the app is plainly using.
 */
export async function listKeyStatus(now: Date = new Date()): Promise<KeyStatus[]> {
  const today = dayKey(now);
  const out: KeyStatus[] = [];

  for (const provider of KEYED_PROVIDERS) {
    const rows = canUseStoredKeys() ? await loadRows(provider) : [];

    for (const row of rows) {
      out.push({
        id: row.id,
        provider,
        hint: row.hint,
        order: row.order,
        source: "db",
        spent: row.spentOn === today,
        disabled: row.disabled,
        lastError: row.lastError,
      });
    }

    // Environment keys appear only when no row has overridden them, which is
    // what `listKeys` would actually use. A panel listing keys the app is
    // ignoring is worse than one listing none.
    if (rows.length > 0) continue;

    for (const [i, key] of envKeys(provider).entries()) {
      out.push({
        id: key.id,
        provider,
        hint: key.hint,
        order: i,
        source: "env",
        spent: false,
        disabled: false,
        lastError: null,
      });
    }
  }

  return out;
}

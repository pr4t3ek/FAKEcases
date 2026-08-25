import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Encryption for API keys held in the database.
 *
 * The keys in `LlmApiKey` are live credentials with a bill attached, so the
 * threat this addresses is the ordinary one: a database dump, a backup copied
 * somewhere less careful, or a Prisma Studio session handing over four
 * providers' worth of working keys in plaintext.
 *
 * AES-256-GCM from `node:crypto` rather than a library, because the repo's rule
 * for adapters applies here too — this is thirty lines of standard-library
 * calls, and a dependency would only make it harder to read.
 *
 * GCM rather than CBC because it authenticates: a tampered ciphertext fails to
 * decrypt rather than silently yielding a corrupted key that then gets sent to
 * a provider as a bearer token.
 */

/** `AUTH_SECRET`'s shipped default, published in `.env.example` and this repo. */
const DEV_AUTH_SECRET = "case-closed-dev-secret-change-me";

/**
 * A fixed salt, which is deliberate and worth explaining.
 *
 * Salts exist to stop one precomputed table covering many users. There is one
 * secret here, not a table of them, and the salt has to be recoverable on every
 * boot to decrypt rows written by the last one — storing it per row would mean
 * an scrypt derivation per key read. What actually protects these rows is
 * `AUTH_SECRET` having real entropy, which `hasStrongAuthSecret()` insists on.
 */
const KEY_SALT = "case-closed:llm-api-key:v1";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

/**
 * Whether `AUTH_SECRET` is set to something worth encrypting under.
 *
 * The shipped default is in this repository's `.env.example`, so anyone who can
 * read a leaked database can also read the key it was encrypted with. That is
 * not encryption, it is the appearance of it — and the appearance is worse than
 * nothing, because it invites people to store real keys believing they are safe.
 *
 * So storing keys in the database is REFUSED until this passes, rather than
 * proceeding with weak protection. `addLlmKey` surfaces it as an error and the
 * admin panel renders it as the card's empty state.
 */
export function hasStrongAuthSecret(): boolean {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 16) return false;

  // Constant-time, though the value it guards is a build-time constant: the
  // comparison is cheap and the habit is the point.
  const a = Buffer.from(secret);
  const b = Buffer.from(DEV_AUTH_SECRET);
  if (a.length === b.length && timingSafeEqual(a, b)) return false;

  return true;
}

/**
 * Derived once per process. scrypt is deliberately slow — that is its job — and
 * doing it per key read would put ~100ms on the hot path of every chat turn.
 */
let cachedKey: Buffer | undefined;

function derivedKey(): Buffer {
  if (cachedKey) return cachedKey;
  if (!hasStrongAuthSecret()) {
    throw new Error("AUTH_SECRET must be set to a strong value before API keys can be stored.");
  }
  cachedKey = scryptSync(process.env.AUTH_SECRET as string, KEY_SALT, 32);
  return cachedKey;
}

/** Stored as one column: `iv:tag:ciphertext`, each base64. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, derivedKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":");
}

/**
 * Returns undefined rather than throwing on anything malformed.
 *
 * A single unreadable row — written under a different `AUTH_SECRET`, or
 * truncated by a bad migration — must not take the whole rotation down with it.
 * `listKeys` drops what it cannot read and carries on with the rest, which is
 * the same "a bad row is ignored, not thrown on" rule `loadSettings` follows.
 */
export function decryptSecret(stored: string): string | undefined {
  try {
    const [ivPart, tagPart, dataPart] = stored.split(":");
    if (!ivPart || !tagPart || !dataPart) return undefined;

    const decipher = createDecipheriv(ALGORITHM, derivedKey(), Buffer.from(ivPart, "base64"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64"));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(dataPart, "base64")),
      decipher.final(),
    ]).toString("utf8");

    return plain || undefined;
  } catch {
    return undefined;
  }
}

/**
 * The only form of a key that may reach a browser.
 *
 * Enough to tell two keys apart in a list and to match one against the provider's
 * own console; not enough to use. Short keys are masked entirely rather than
 * partially — revealing 8 of 12 characters would defeat the point.
 */
export function maskKey(plain: string): string {
  const trimmed = plain.trim();
  if (trimmed.length < 16) return "…".repeat(4);
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

/** Test seam: `AUTH_SECRET` is read once, and vitest's `stubEnv` changes it between cases. */
export function resetDerivedKeyCache(): void {
  cachedKey = undefined;
}

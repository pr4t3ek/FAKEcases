/**
 * The code a professor reads out and sixty people type at once.
 *
 * Pure and DB-free so it can be tested, and separate from `lib/rooms.ts` for the
 * reason `lib/sim/replay.ts` sits apart from `lib/simulations.ts`: that module
 * reaches `server-only`, and a rule left inside it cannot be pulled into a test.
 *
 * The whole design is about transcription, not entropy. A code is spoken aloud,
 * possibly projected in a sans-serif face at the back of a lecture hall, and
 * retyped on a phone. So the alphabet drops every glyph pair that gets confused
 * — and, more usefully, `normaliseRoomCode` FOLDS the confusable characters onto
 * the ones they are mistaken for, so a student who types `O` for `0` gets in
 * rather than getting an error they cannot see the cause of.
 */

/**
 * Crockford base32: the decimal digits and the alphabet minus `I`, `L`, `O`
 * and `U`.
 *
 * `I`/`L` fold to `1` and `O` folds to `0` at the door, which is why they are
 * absent here — a character that is accepted on input must not also be
 * *emitted*, or two different codes would normalise to the same string and the
 * unique constraint would be enforcing something other than what it looks like.
 *
 * `U` is dropped for the reason Crockford drops it: it keeps accidental
 * obscenities out of a code that gets read to a room.
 */
export const ROOM_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * Six characters, ~1.07 x 10^9 codes.
 *
 * Long enough that guessing one is not a strategy — and the password behind it
 * is the actual control anyway — and short enough to say twice without anyone
 * asking for it a third time. Eight was the first instinct and is worse: the
 * marginal security is nil next to the password, and the transcription error
 * rate is not.
 */
export const ROOM_CODE_LENGTH = 6;

/**
 * A fresh code.
 *
 * `random` is injectable so a test can pin the output without stubbing globals.
 * The caller retries on the unique-constraint collision — see `createRoom` —
 * which is the control; this is just the draw.
 */
export function generateRoomCode(random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    const index = Math.floor(random() * ROOM_CODE_ALPHABET.length);
    // Guards a `random()` that returns exactly 1, which `Math.random` never does
    // but an injected generator might.
    code += ROOM_CODE_ALPHABET[Math.min(index, ROOM_CODE_ALPHABET.length - 1)];
  }
  return code;
}

/**
 * What the student typed, as the stored code would have been written.
 *
 * Every lookup goes through this, so `ABC-123`, `abc 123` and `abc123` are one
 * code. The letter folding is the part that earns its keep: `O`→`0` and
 * `I`/`L`→`1` are the three substitutions people actually make, and each one
 * would otherwise be a student stuck at the door with a code that looks correct
 * to them.
 */
export function normaliseRoomCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    // Spaces and hyphens are how people punctuate something they were told
    // aloud, and they carry no information.
    .replace(/[\s-]/g, "")
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0");
}

/** Whether a normalised string could be a code at all — the cheap pre-check. */
export function isRoomCode(value: string): boolean {
  if (value.length !== ROOM_CODE_LENGTH) return false;
  return [...value].every((char) => ROOM_CODE_ALPHABET.includes(char));
}

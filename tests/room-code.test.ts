import { describe, expect, it } from "vitest";
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  generateRoomCode,
  isRoomCode,
  normaliseRoomCode,
} from "@/lib/rooms/code";

/** A deterministic stand-in for Math.random, cycling a fixed sequence. */
function seeded(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("generateRoomCode", () => {
  it("is the declared length", () => {
    expect(generateRoomCode()).toHaveLength(ROOM_CODE_LENGTH);
  });

  it("only ever emits characters from the alphabet", () => {
    // 500 draws rather than one: an off-by-one in the index would show up as a
    // rare `undefined` in the string, which a single sample would miss.
    for (let i = 0; i < 500; i++) {
      for (const char of generateRoomCode()) {
        expect(ROOM_CODE_ALPHABET).toContain(char);
      }
    }
  });

  it("is deterministic given a deterministic generator", () => {
    expect(generateRoomCode(seeded([0]))).toBe("000000");
    expect(generateRoomCode(seeded([0.999999]))).toBe("ZZZZZZ");
  });

  it("survives a generator that returns exactly 1", () => {
    // Math.random never does, but the parameter is injectable and a caller's
    // generator might. An unguarded index would read past the alphabet and put
    // "undefined" in a room code.
    expect(generateRoomCode(seeded([1]))).toBe("ZZZZZZ");
  });
});

describe("the alphabet", () => {
  /**
   * The load-bearing property. `normaliseRoomCode` folds O onto 0 and I/L onto
   * 1, so if the generator could ever EMIT one of those, two distinct codes
   * would normalise to the same string — and the unique constraint on `code`
   * would be guarding something other than what it appears to.
   */
  it("never emits a character that normalisation folds away", () => {
    for (const confusable of ["I", "L", "O"]) {
      expect(ROOM_CODE_ALPHABET).not.toContain(confusable);
    }
  });

  it("drops U, so a code read aloud cannot spell something unfortunate", () => {
    expect(ROOM_CODE_ALPHABET).not.toContain("U");
  });

  it("has no duplicates", () => {
    expect(new Set(ROOM_CODE_ALPHABET).size).toBe(ROOM_CODE_ALPHABET.length);
  });

  it("round-trips every generated code through normalisation unchanged", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode();
      expect(normaliseRoomCode(code)).toBe(code);
    }
  });
});

describe("normaliseRoomCode", () => {
  it("upcases", () => {
    expect(normaliseRoomCode("a1b2c3")).toBe("A1B2C3");
  });

  it("strips the punctuation people add to something they heard aloud", () => {
    expect(normaliseRoomCode("A1B-2C3")).toBe("A1B2C3");
    expect(normaliseRoomCode(" A1B 2C3 ")).toBe("A1B2C3");
    expect(normaliseRoomCode("A1B - 2C3")).toBe("A1B2C3");
  });

  it("folds O onto zero", () => {
    // The single most common transcription error off a projector.
    expect(normaliseRoomCode("ABCDO9")).toBe("ABCD09");
    expect(normaliseRoomCode("abcdo9")).toBe("ABCD09");
  });

  it("folds I and L onto one", () => {
    expect(normaliseRoomCode("ABCDI9")).toBe("ABCD19");
    expect(normaliseRoomCode("ABCDL9")).toBe("ABCD19");
  });

  it("is idempotent", () => {
    // Every lookup runs it, and some run it twice (the route handler and then
    // the data layer). A second pass must not change the answer.
    const once = normaliseRoomCode("ab-cdo9");
    expect(normaliseRoomCode(once)).toBe(once);
  });

  it("leaves an already-clean code alone", () => {
    expect(normaliseRoomCode("A1B2C3")).toBe("A1B2C3");
  });
});

describe("isRoomCode", () => {
  it("accepts a generated code", () => {
    expect(isRoomCode(generateRoomCode())).toBe(true);
  });

  it("rejects the wrong length", () => {
    expect(isRoomCode("A1B2C")).toBe(false);
    expect(isRoomCode("A1B2C34")).toBe(false);
    expect(isRoomCode("")).toBe(false);
  });

  it("rejects characters outside the alphabet", () => {
    // Checked against a NORMALISED string, so these are genuinely impossible
    // rather than merely unfolded.
    expect(isRoomCode("A1B2C!")).toBe(false);
    expect(isRoomCode("a1b2c3")).toBe(false);
  });
});

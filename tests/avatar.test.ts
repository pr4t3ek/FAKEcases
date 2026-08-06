import { describe, expect, it } from "vitest";
import {
  avatarUrlFor,
  base64ByteLength,
  initialsFor,
  sniffImageMime,
  validateAvatarDataUri,
} from "@/lib/avatar";
import { avatarLimits } from "@/lib/config";

const JPEG_MAGIC = [0xff, 0xd8, 0xff, 0xe0];
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** A data URI whose bytes really do start with the given magic numbers. */
function dataUri(declared: string, magic: number[], padTo = 64): string {
  const bytes = Buffer.concat([
    Buffer.from(magic),
    Buffer.alloc(Math.max(0, padTo - magic.length), 0x20),
  ]);
  return `data:${declared};base64,${bytes.toString("base64")}`;
}

function webpBytes(): Buffer {
  const b = Buffer.alloc(32, 0x20);
  b.write("RIFF", 0, "ascii");
  b.write("WEBP", 8, "ascii");
  return b;
}

describe("base64ByteLength", () => {
  it("reports the decoded size rather than the length of the base64 text", () => {
    const bytes = Buffer.alloc(300, 1);
    const encoded = bytes.toString("base64");
    expect(encoded.length).toBeGreaterThan(300);
    expect(base64ByteLength(encoded)).toBe(300);
  });

  it("accounts for padding", () => {
    expect(base64ByteLength(Buffer.alloc(1).toString("base64"))).toBe(1);
    expect(base64ByteLength(Buffer.alloc(2).toString("base64"))).toBe(2);
    expect(base64ByteLength(Buffer.alloc(3).toString("base64"))).toBe(3);
  });
});

describe("sniffImageMime", () => {
  it("recognises a JPEG by its leading bytes", () => {
    expect(sniffImageMime(Buffer.from(JPEG_MAGIC))).toBe("image/jpeg");
  });

  it("recognises a PNG by its signature", () => {
    expect(sniffImageMime(Buffer.from(PNG_MAGIC))).toBe("image/png");
  });

  it("recognises a WebP by the RIFF and WEBP markers together", () => {
    expect(sniffImageMime(webpBytes())).toBe("image/webp");
  });

  it("returns nothing for a RIFF container that isn't WebP", () => {
    const wav = Buffer.alloc(32, 0x20);
    wav.write("RIFF", 0, "ascii");
    wav.write("WAVE", 8, "ascii");
    expect(sniffImageMime(wav)).toBeNull();
  });

  it("returns nothing for bytes that are not an image at all", () => {
    expect(sniffImageMime(Buffer.from("#!/bin/sh\nrm -rf /"))).toBeNull();
  });
});

describe("validateAvatarDataUri", () => {
  it("accepts a JPEG whose bytes agree with its declared type", () => {
    const result = validateAvatarDataUri(dataUri("image/jpeg", JPEG_MAGIC));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.mime).toBe("image/jpeg");
  });

  /**
   * The check the whole module exists for. The declared media type is a claim
   * by whoever posted it, and the avatar is served back out of our own origin
   * with the type we stored — so the bytes have to corroborate it.
   */
  it("rejects a payload that only claims to be an image", () => {
    const evil = Buffer.from("<script>alert(1)</script>").toString("base64");
    const result = validateAvatarDataUri(`data:image/jpeg;base64,${evil}`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/isn't a JPEG, PNG or WebP/);
  });

  it("trusts the bytes over the declaration when the two disagree", () => {
    // Declared PNG, actually a JPEG. Both are allowed types, so this is not a
    // refusal — but what gets stored, and later served as a Content-Type, must
    // be what the bytes actually are.
    const result = validateAvatarDataUri(dataUri("image/png", JPEG_MAGIC));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.mime).toBe("image/jpeg");
  });

  it("rejects an SVG, which is a document that can carry script", () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString("base64");
    const result = validateAvatarDataUri(`data:image/svg+xml;base64,${svg}`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/isn't supported/);
  });

  it("rejects a payload over the byte cap", () => {
    const huge = Buffer.concat([
      Buffer.from(JPEG_MAGIC),
      Buffer.alloc(avatarLimits.maxBytes + 1024, 0x20),
    ]);
    const result = validateAvatarDataUri(`data:image/jpeg;base64,${huge.toString("base64")}`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/too large/);
  });

  it("rejects anything that isn't a base64 data URI", () => {
    for (const input of ["https://example.com/me.jpg", "", "data:image/jpeg,notbase64", 42, null]) {
      expect(validateAvatarDataUri(input).ok).toBe(false);
    }
  });

  it("rejects an empty payload rather than storing a zero-byte image", () => {
    expect(validateAvatarDataUri("data:image/jpeg;base64,").ok).toBe(false);
  });
});

describe("avatarUrlFor", () => {
  it("puts the version in the URL, so a replaced photo is never served from cache", () => {
    expect(avatarUrlFor("abc", 1)).not.toBe(avatarUrlFor("abc", 2));
    expect(avatarUrlFor("abc", 2)).toBe("/api/avatar/abc?v=2");
  });
});

describe("initialsFor", () => {
  it("takes the first letter of the first and last words of a name", () => {
    expect(initialsFor("Ankit Kumar Rai")).toBe("AR");
  });

  it("returns two letters for a single-word name", () => {
    expect(initialsFor("Ankit")).toBe("AN");
  });

  it("falls back to the email when there is no name", () => {
    expect(initialsFor(null, "ananya.rao@example.com")).toBe("AR");
  });

  it("returns a placeholder rather than an empty badge when it has nothing", () => {
    expect(initialsFor(null, null)).toBe("?");
    expect(initialsFor("   ")).toBe("?");
  });
});

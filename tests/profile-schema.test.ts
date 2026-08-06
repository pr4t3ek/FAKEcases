import { describe, expect, it } from "vitest";
import {
  onboardingSchema,
  parseTargetLevels,
  profileSchema,
  toProfileColumns,
} from "@/lib/profile-schema";
import { COLLEGE_OTHER } from "@/lib/config/colleges";
import { gradYearRange, profileLimits } from "@/lib/config";

const base = (over: Record<string, unknown> = {}) => ({
  name: "Ankit Rai",
  phone: "",
  city: "",
  bio: "",
  profession: "",
  collegeId: "",
  collegeOther: "",
  gradYear: "",
  experience: "",
  targetLevels: [],
  targetCompanies: "",
  ...over,
});

const parse = (over: Record<string, unknown> = {}) => profileSchema.safeParse(base(over));
const errorOf = (over: Record<string, unknown>) => {
  const r = profileSchema.safeParse(base(over));
  return r.success ? null : r.error.issues[0].message;
};

describe("profileSchema", () => {
  it("accepts a profile with nothing filled in but a name", () => {
    expect(parse().success).toBe(true);
  });

  it("requires a name, since it is what the whole app greets you by", () => {
    expect(parse({ name: "   " }).success).toBe(false);
  });

  /**
   * The bug this closes, inherited from `lib/question-schema.ts`: a blank
   * number field run through `z.coerce.number()` becomes a real 0, which here
   * would be a profile claiming to have graduated in the year zero.
   */
  it("leaves a blank graduation year absent rather than storing it as zero", () => {
    const result = parse({ gradYear: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.gradYear).toBeUndefined();
  });

  it("rejects a graduation year outside the window the form offers", () => {
    expect(parse({ gradYear: String(gradYearRange.max + 1) }).success).toBe(false);
    expect(parse({ gradYear: String(gradYearRange.min - 1) }).success).toBe(false);
    expect(parse({ gradYear: String(gradYearRange.max) }).success).toBe(true);
  });

  it("requires the written-in college when Other is chosen", () => {
    expect(errorOf({ collegeId: COLLEGE_OTHER })).toMatch(/Write in the name/);
    expect(parse({ collegeId: COLLEGE_OTHER, collegeOther: "Some College" }).success).toBe(true);
  });

  it("refuses a written-in college that nobody chose Other for", () => {
    // Otherwise the text would be silently discarded on save, which looks like
    // the field simply not working.
    expect(errorOf({ collegeOther: "Some College" })).toMatch(/Choose/);
  });

  it("rejects a college id that is not on the curated list", () => {
    expect(errorOf({ collegeId: "iim-atlantis" })).toMatch(/isn't on the list/);
    expect(parse({ collegeId: "iim-bangalore" }).success).toBe(true);
  });

  it("rejects a target level outside INTERVIEW_LEVELS", () => {
    expect(parse({ targetLevels: ["Deloitte"] }).success).toBe(false);
  });

  it("caps how many target levels one person can claim", () => {
    const tooMany = ["BCG", "McKinsey", "Bain", "Big4", "PM"];
    expect(tooMany.length).toBeGreaterThan(profileLimits.targetLevels);
    expect(parse({ targetLevels: tooMany }).success).toBe(false);
  });

  it("reads target levels from a pipe-separated string, as a form post sends them", () => {
    const result = parse({ targetLevels: "BCG|PM" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.targetLevels).toEqual(["BCG", "PM"]);
  });

  it("rejects a bio longer than the limit rather than truncating it silently", () => {
    expect(parse({ bio: "x".repeat(profileLimits.bio + 1) }).success).toBe(false);
  });

  it("accepts an Indian mobile number in the shapes people actually type", () => {
    for (const phone of ["+91 98765 43210", "9876543210", "080-2222-3333"]) {
      expect(parse({ phone }).success, phone).toBe(true);
    }
  });

  it("rejects something that is plainly not a phone number", () => {
    expect(parse({ phone: "call me" }).success).toBe(false);
  });
});

describe("onboardingSchema", () => {
  it("accepts an entirely empty answer, because every step is skippable", () => {
    expect(onboardingSchema.safeParse({}).success).toBe(true);
  });

  it("applies the same college rule the full profile does", () => {
    // The point of sharing `refineProfile`: a field cannot validate one way at
    // /welcome and another at /profile.
    expect(onboardingSchema.safeParse({ collegeId: COLLEGE_OTHER }).success).toBe(false);
  });
});

describe("toProfileColumns", () => {
  it("sends a curated college to User and nothing to the write-in", () => {
    const { user, profile } = toProfileColumns({ collegeId: "iim-bangalore" });
    expect(user.collegeId).toBe("iim-bangalore");
    expect(profile.collegeOther).toBeNull();
  });

  /**
   * "Other" is a form value, never a stored one. Keeping it out of the column
   * is what lets every reader ask `collegeId != null` instead of remembering to
   * also exclude a magic string.
   */
  it("stores Other as a null id plus the written-in name", () => {
    const { user, profile } = toProfileColumns({
      collegeId: COLLEGE_OTHER,
      collegeOther: "Some College",
    });
    expect(user.collegeId).toBeNull();
    expect(profile.collegeOther).toBe("Some College");
  });

  it("writes null rather than an empty string for a field left blank", () => {
    const { profile } = toProfileColumns({ city: "", bio: "" });
    expect(profile.city).toBeNull();
    expect(profile.bio).toBeNull();
  });

  it("serialises target levels as JSON", () => {
    const { profile } = toProfileColumns({ targetLevels: ["BCG", "PM"] });
    expect(profile.targetLevels).toBe('["BCG","PM"]');
  });

  it("leaves a field out entirely when the caller didn't submit it", () => {
    // The onboarding step posts a subset, and an absent field must not be
    // read as a request to clear the value already stored.
    const { user, profile } = toProfileColumns({ profession: "working" });
    expect(profile.profession).toBe("working");
    expect("collegeId" in user).toBe(false);
    expect("bio" in profile).toBe(false);
  });
});

describe("parseTargetLevels", () => {
  it("reads back what toProfileColumns wrote", () => {
    expect(parseTargetLevels('["BCG","PM"]')).toEqual(["BCG", "PM"]);
  });

  it("returns nothing for malformed JSON rather than throwing", () => {
    expect(parseTargetLevels("{oops")).toEqual([]);
    expect(parseTargetLevels(null)).toEqual([]);
  });

  it("drops a level that is no longer one of INTERVIEW_LEVELS", () => {
    expect(parseTargetLevels('["BCG","Consulting"]')).toEqual(["BCG"]);
  });

  it("ignores stored JSON that isn't an array at all", () => {
    expect(parseTargetLevels('{"a":1}')).toEqual([]);
  });
});

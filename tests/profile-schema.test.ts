import { describe, expect, it } from "vitest";
import {
  onboardingSchema,
  parseTargetLevels,
  professorRequestFor,
  profileSchema,
  toProfileColumns,
} from "@/lib/profile-schema";
import { profileLimits } from "@/lib/config";

const base = (over: Record<string, unknown> = {}) => ({
  name: "Ankit Rai",
  phone: "",
  city: "",
  bio: "",
  profession: "",
  batch: "pgp1",
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
  it("accepts a profile with nothing filled in but a name and a batch", () => {
    expect(parse().success).toBe(true);
  });

  /**
   * The one field besides the name that a save cannot omit: it shows on every
   * leaderboard row, and a blank there is a row nobody can read.
   */
  it("refuses a profile with no batch, in the words the form shows", () => {
    expect(errorOf({ batch: "" })).toBe("Choose your batch");
    expect(errorOf({ batch: undefined })).toBe("Choose your batch");
  });

  it("refuses a batch that isn't one of the two", () => {
    // Same message for an unknown id as for a blank one: both mean "that is not
    // an answer", and zod's default here names the internal ids.
    expect(errorOf({ batch: "pgp3" })).toBe("Choose your batch");
  });

  it("accepts either real batch", () => {
    expect(parse({ batch: "pgp1" }).success).toBe(true);
    expect(parse({ batch: "pgp2" }).success).toBe(true);
  });

  it("requires a name, since it is what the whole app greets you by", () => {
    expect(parse({ name: "   " }).success).toBe(false);
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
  it("accepts an answer that fills in nothing but the batch", () => {
    // Everything else on this step stays skippable; the batch is the one thing
    // it now has to come back with.
    expect(onboardingSchema.safeParse({ batch: "pgp2" }).success).toBe(true);
  });

  it("refuses an empty answer, because the batch is required on both surfaces", () => {
    expect(onboardingSchema.safeParse({}).success).toBe(false);
  });

  it("applies the same batch rule the full profile does", () => {
    // The point of sharing one core: a field cannot validate one way at
    // /welcome and another at /profile.
    expect(onboardingSchema.safeParse({ batch: "pgp3" }).success).toBe(false);
  });
});

describe("toProfileColumns", () => {
  /**
   * Beside `collegeId` on `User` rather than on `Profile`, because a board
   * groups by it. Getting this wrong puts the batch on a table the leaderboard
   * query never reads.
   */
  it("sends the batch to User, not to Profile", () => {
    const { user, profile } = toProfileColumns({ batch: "pgp2" });
    expect(user.batch).toBe("pgp2");
    expect(profile.batch).toBeUndefined();
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
    const { user, profile } = toProfileColumns({ profession: "professor" });
    expect(profile.profession).toBe("professor");
    expect("batch" in user).toBe(false);
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

/**
 * The rule that keeps a dropdown from handing out classroom access.
 *
 * `undefined` means "leave the column alone" and is not the same as `null`,
 * which withdraws a pending request — the difference is the whole reason this
 * returns three things rather than a date or nothing.
 */
describe("professorRequestFor", () => {
  const now = new Date("2026-08-18T00:00:00Z");

  it("stamps a request when a plain user says they are a professor", () => {
    expect(professorRequestFor("professor", "user", null, now)).toEqual(now);
  });

  it("never touches the column for someone who already holds the role", () => {
    // Including admins: an admin editing their own profile must not appear in
    // their own approval queue.
    expect(professorRequestFor("professor", "professor", null, now)).toBeUndefined();
    expect(professorRequestFor("professor", "admin", null, now)).toBeUndefined();
  });

  it("keeps the original stamp when someone asks again", () => {
    // Otherwise re-saving a profile would push them to the back of a queue
    // ordered by when people actually asked.
    const asked = new Date("2026-08-01T00:00:00Z");
    expect(professorRequestFor("professor", "user", asked, now)).toEqual(asked);
  });

  it("withdraws the request when they switch back to Student", () => {
    const asked = new Date("2026-08-01T00:00:00Z");
    expect(professorRequestFor("student", "user", asked, now)).toBeNull();
  });

  it("does nothing when there was no request to withdraw", () => {
    expect(professorRequestFor("student", "user", null, now)).toBeUndefined();
  });

  it("treats an unanswered occupation as silence, not as a withdrawal", () => {
    // A partial save must not cancel a request somebody is waiting on.
    const asked = new Date("2026-08-01T00:00:00Z");
    expect(professorRequestFor(undefined, "user", asked, now)).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { AI_MODES, aiModes, selectableMode, transcriptFor } from "@/lib/config";

/**
 * Which conversation modes are offered, and which merely exist.
 *
 * The picker was narrowed to Interviewer and Teacher, but the two that went are
 * not gone from the data: `/api/hint` stamps `coach` on every hint turn it
 * writes, and attempts recorded while all four were offered still carry theirs.
 * The gap between "selectable" and "storable" is the whole point of these tests
 * — collapsing it would either break the hint path or leave a live attempt
 * rendering a picker with nothing selected.
 */

describe("aiModes", () => {
  it("offers exactly the two that mean something different", () => {
    // Interviewer is the exercise; Teacher is being told. Coach duplicated the
    // hint button without its counter, and Evaluator duplicated the report.
    expect(aiModes.map((m) => m.key)).toEqual(["interviewer", "teacher"]);
  });

  it("still describes every mode the database can hold", () => {
    // `Message.mode` and `Attempt.mode` are strings written by more than the
    // picker, so the type has to stay wider than the button row.
    expect(AI_MODES).toContain("coach");
    expect(AI_MODES).toContain("evaluator");
    for (const m of aiModes) expect(AI_MODES).toContain(m.key);
  });
});

describe("selectableMode", () => {
  it("passes through a mode that is still offered", () => {
    expect(selectableMode("interviewer")).toBe("interviewer");
    expect(selectableMode("teacher")).toBe("teacher");
  });

  it("falls back to the interviewer for one that no longer is", () => {
    // An attempt left mid-session on Coach must open on something, and the
    // interviewer is the honest default: it is the mode that reveals nothing.
    expect(selectableMode("coach")).toBe("interviewer");
    expect(selectableMode("evaluator")).toBe("interviewer");
  });

  it("survives the states a database column actually reaches", () => {
    expect(selectableMode(null)).toBe("interviewer");
    expect(selectableMode(undefined)).toBe("interviewer");
    expect(selectableMode("")).toBe("interviewer");
    expect(selectableMode("something-invented")).toBe("interviewer");
  });

  it("never returns a mode the picker cannot show", () => {
    const offered = aiModes.map((m) => m.key);
    for (const stored of [...AI_MODES, "", "nonsense", null, undefined]) {
      expect(offered).toContain(selectableMode(stored as string));
    }
  });
});

/**
 * Which transcript a turn belongs in.
 *
 * The two modes are two conversations. Asking the Teacher used to drop its
 * answer into the interview as well, so switching back showed the solution you
 * had just been handed — the interview reading as though it had spoiled itself.
 */
describe("transcriptFor", () => {
  it("files a teacher turn under teacher", () => {
    expect(transcriptFor("teacher")).toBe("teacher");
  });

  it("files an interview turn under the interview", () => {
    expect(transcriptFor("interviewer")).toBe("interviewer");
  });

  it("files a hint under the interview, not the teacher", () => {
    // `/api/hint` stamps `coach`, but a hint is asked for and answered inside
    // the interview — showing it in the Teacher box would be filing it by its
    // implementation rather than by where it was said.
    expect(transcriptFor("coach")).toBe("interviewer");
  });

  it("files a legacy evaluator turn under the interview", () => {
    expect(transcriptFor("evaluator")).toBe("interviewer");
  });

  it("files an unstamped turn under the interview", () => {
    // Rows written before the split carry no mode. They were said in the
    // interview, which is the only conversation that existed.
    expect(transcriptFor(null)).toBe("interviewer");
    expect(transcriptFor(undefined)).toBe("interviewer");
    expect(transcriptFor("")).toBe("interviewer");
  });

  it("puts every storable mode in exactly one transcript", () => {
    const offered = aiModes.map((m) => m.key);
    for (const m of AI_MODES) expect(offered).toContain(transcriptFor(m));
  });

  it("keeps teacher out of the interview for every other mode", () => {
    // The property that matters: nothing except `teacher` reaches the teacher
    // box, so the solution cannot leak into the interview through a new mode.
    for (const m of AI_MODES) {
      if (m !== "teacher") expect(transcriptFor(m)).toBe("interviewer");
    }
  });
});

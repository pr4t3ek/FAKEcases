import { describe, it, expect } from "vitest";
import { questionImportSchema } from "@/lib/questions";
import { toQuestionColumns } from "@/lib/question-schema";
import { parseCsv, QUESTION_CSV_TEMPLATE } from "@/lib/csv";

const guesstimateRow = (over: Record<string, unknown> = {}) => ({
  title: "ATMs in Chennai",
  prompt: "Estimate the number of ATMs in Chennai.",
  category: "finance",
  difficulty: "Medium",
  interviewLevel: "McKinsey",
  idealLow: "3000",
  idealHigh: "8000",
  betterApproach: "Bank branches x ATMs per branch.",
  sampleSolution: "~5000 ATMs.",
  ...over,
});

const caseRow = (over: Record<string, unknown> = {}) => ({
  title: "Falling delivery margins",
  prompt: "Contribution margin per order fell 30% in two years. Why?",
  category: "startups",
  difficulty: "Hard",
  interviewLevel: "BCG",
  type: "qualitative",
  framework: "profitability",
  expectedBuckets: "Revenue | Cost",
  rootCause: '{"path":["Cost","Delivery cost"]}',
  betterApproach: "Split margin into revenue and cost per order first.",
  sampleSolution: "Delivery cost per order is the driver.",
  ...over,
});

describe("questionImportSchema", () => {
  it("accepts a well-formed row", () => {
    const r = questionImportSchema.safeParse({
      title: "ATMs in Chennai",
      prompt: "Estimate the number of ATMs in Chennai.",
      category: "finance",
      difficulty: "Medium",
      interviewLevel: "McKinsey",
      idealLow: "3000",
      idealHigh: "8000",
      unit: "ATMs",
      betterApproach: "Bank branches x ATMs per branch.",
      sampleSolution: "~5000 ATMs.",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.idealLow).toBe(3000); // coerced to number
    }
  });

  it("rejects an invalid difficulty and missing fields", () => {
    const r = questionImportSchema.safeParse({
      title: "x",
      prompt: "y",
      category: "finance",
      difficulty: "Impossible",
      interviewLevel: "McKinsey",
    });
    expect(r.success).toBe(false);
  });

  it("defaults an unlabelled row to a guesstimate", () => {
    const r = questionImportSchema.safeParse(guesstimateRow());
    expect(r.success && r.data.type).toBe("guesstimate");
  });

  it("still requires an ideal range on a guesstimate", () => {
    const r = questionImportSchema.safeParse(guesstimateRow({ idealLow: "", idealHigh: "" }));
    expect(r.success).toBe(false);
  });

  it("rejects an inverted ideal range", () => {
    const r = questionImportSchema.safeParse(guesstimateRow({ idealLow: "9000", idealHigh: "10" }));
    expect(r.success).toBe(false);
  });
});

describe("questionImportSchema — cases", () => {
  it("accepts a case with no ideal range", () => {
    const r = questionImportSchema.safeParse(caseRow());
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.type).toBe("qualitative");
      expect(r.data.rootCause).toEqual({ path: ["Cost", "Delivery cost"] });
      expect(r.data.expectedBuckets).toEqual(["Revenue", "Cost"]);
    }
  });

  /**
   * The bug this closes. A blank number field coerced to 0, so editing a case
   * through the admin form stamped a fabricated 0–0 ideal range onto it.
   */
  it("refuses to put an ideal range on a case", () => {
    const r = questionImportSchema.safeParse(caseRow({ idealLow: "0", idealHigh: "0" }));
    expect(r.success).toBe(false);
  });

  it("leaves the ideal range null rather than zero", () => {
    const r = questionImportSchema.safeParse(caseRow());
    expect(r.success && toQuestionColumns(r.data).idealLow).toBe(null);
  });

  // A typo used to be silent: the column stored whatever was typed, and
  // diagnosis scoring just never found a root cause to grade against.
  it("rejects a rootCause that isn't valid JSON", () => {
    const r = questionImportSchema.safeParse(caseRow({ rootCause: "{path: Cost}" }));
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => /rootCause must be valid JSON/.test(i.message))).toBe(true);
    }
  });

  it("rejects a rootCause with the wrong shape", () => {
    const r = questionImportSchema.safeParse(caseRow({ rootCause: '{"note":"no path here"}' }));
    expect(r.success).toBe(false);
  });

  it("rejects a dataPack entry missing its fact", () => {
    const r = questionImportSchema.safeParse(caseRow({ dataPack: '[{"topic":["cost"]}]' }));
    expect(r.success).toBe(false);
  });

  it("reads expectedBuckets as a pipe-separated list or a JSON array", () => {
    const piped = questionImportSchema.safeParse(caseRow({ expectedBuckets: "Revenue | Cost" }));
    const json = questionImportSchema.safeParse(
      caseRow({ expectedBuckets: '["Revenue","Cost"]' }),
    );
    expect(piped.success && piped.data.expectedBuckets).toEqual(["Revenue", "Cost"]);
    expect(json.success && json.data.expectedBuckets).toEqual(["Revenue", "Cost"]);
  });

  it("keeps case-only columns off a guesstimate", () => {
    const r = questionImportSchema.safeParse(
      guesstimateRow({ rootCause: '{"path":["Cost"]}' }),
    );
    expect(r.success).toBe(false);
  });
});

describe("parseCsv", () => {
  it("parses the question template with quoted fields", () => {
    const rows = parseCsv(QUESTION_CSV_TEMPLATE);
    expect(rows.length).toBe(2);
    expect(rows[0].title).toBe("Number of ATMs in Chennai");
    expect(rows[0].betterApproach).toContain("ATMs per branch");
    expect(rows[0].externalId).toBe("atms-chennai");
  });

  // The template is the thing an author actually starts from, so it has to
  // survive the round trip it advertises.
  it("round-trips both template rows through the import schema", () => {
    for (const row of parseCsv(QUESTION_CSV_TEMPLATE)) {
      const r = questionImportSchema.safeParse(row);
      expect(r.success, `${row.title}: ${JSON.stringify(r.error?.issues)}`).toBe(true);
    }
  });

  it("handles embedded commas and escaped quotes", () => {
    const csv = 'a,b\n"hello, world","she said ""hi"""';
    const rows = parseCsv(csv);
    expect(rows[0].a).toBe("hello, world");
    expect(rows[0].b).toBe('she said "hi"');
  });
});

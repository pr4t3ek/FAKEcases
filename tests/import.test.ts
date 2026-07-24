import { describe, it, expect } from "vitest";
import { questionImportSchema } from "@/lib/questions";
import { parseCsv, QUESTION_CSV_TEMPLATE } from "@/lib/csv";

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
});

describe("parseCsv", () => {
  it("parses the question template with quoted fields", () => {
    const rows = parseCsv(QUESTION_CSV_TEMPLATE);
    expect(rows.length).toBe(1);
    expect(rows[0].title).toBe("Number of ATMs in Chennai");
    expect(rows[0].betterApproach).toContain("ATMs per branch");
    expect(rows[0].externalId).toBe("atms-chennai");
  });

  it("handles embedded commas and escaped quotes", () => {
    const csv = 'a,b\n"hello, world","she said ""hi"""';
    const rows = parseCsv(csv);
    expect(rows[0].a).toBe("hello, world");
    expect(rows[0].b).toBe('she said "hi"');
  });
});

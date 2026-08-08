import { describe, expect, it } from "vitest";
import { questions as seedQuestions, categories as seedCategories } from "@/prisma/seed-data";
import { questionImportSchema } from "@/lib/questions";
import { toQuestionColumns } from "@/lib/question-schema";
import {
  COMPANY_LEVELS,
  INTERVIEW_LEVELS,
  SECTORS,
  SECTOR_LABELS,
  isCompanyLevel,
  isSimulation,
  type Sector,
} from "@/lib/types";

const isSector = (v: string): v is Sector => (SECTORS as readonly string[]).includes(v);

describe("COMPANY_LEVELS", () => {
  it("is a strict subset of the interview-level vocabulary", () => {
    // Derived by subtraction, never written out again. `INTERVIEW_LEVELS` is
    // also the enum behind the authoring contract and profile goals, so this is
    // the assertion that catches someone "simplifying" the filter by narrowing
    // the source list instead.
    for (const level of COMPANY_LEVELS) {
      expect(INTERVIEW_LEVELS).toContain(level);
    }
    expect(COMPANY_LEVELS.length).toBeLessThan(INTERVIEW_LEVELS.length);
  });

  it("is the four firms and nothing else", () => {
    expect(COMPANY_LEVELS).toEqual(["BCG", "McKinsey", "Bain", "Big4"]);
  });

  it("excludes the levels that name a role rather than an employer", () => {
    // The whole point of the filter: "General MBA" is not a company you could
    // be interviewing with, and a control labelled "All companies" that offers
    // it is asking the candidate to read it as one.
    for (const role of ["PM", "Product", "GeneralMBA"]) {
      expect(isCompanyLevel(role)).toBe(false);
      expect(INTERVIEW_LEVELS).toContain(role);
    }
  });

  it("keeps every role reachable through the unfiltered view", () => {
    // Restricting the filter must not strand content. These questions carry no
    // company, so "All companies" is the only way to them — which is why the
    // library must never default to a company.
    const roleQuestions = seedQuestions.filter(
      (q) => !isSimulation(q.type ?? "guesstimate") && !isCompanyLevel(q.interviewLevel),
    );
    expect(roleQuestions.length).toBeGreaterThan(0);
  });
});

describe("SECTORS", () => {
  it("labels every value", () => {
    for (const sector of SECTORS) {
      expect(SECTOR_LABELS[sector]).toBeTruthy();
    }
    expect(Object.keys(SECTOR_LABELS).sort()).toEqual([...SECTORS].sort());
  });

  it("gives every seeded question a sector from the vocabulary", () => {
    // The seed's `sector` is required while the column is nullable, so this is
    // where a typo becomes a test failure rather than a filter option that
    // silently matches nothing.
    for (const q of seedQuestions) {
      expect(isSector(q.sector), `${q.externalId} has sector "${q.sector}"`).toBe(true);
    }
  });

  it("offers no sector the catalogue cannot fill", () => {
    // The same class of bug the surface-aware category list fixed: an option
    // that can only ever render the empty state. Checked against the seed so a
    // sector added in advance of its content fails here rather than in the UI.
    const used = new Set(seedQuestions.map((q) => q.sector));
    for (const sector of SECTORS) {
      expect(used.has(sector), `no seeded question uses "${sector}"`).toBe(true);
    }
  });

  it("has sectors that live on only one surface", () => {
    // Why `listSectors` takes a surface. Technology, Manufacturing and Energy
    // are carried only by war rooms, so a static list would give /library three
    // options that can only render the empty state — the same defect as the
    // "Product Management" category, one dropdown to the left.
    const onSurface = (simulation: boolean) =>
      new Set(
        seedQuestions
          .filter((q) => isSimulation(q.type ?? "guesstimate") === simulation)
          .map((q) => q.sector),
      );
    const practice = onSurface(false);
    const warRooms = onSurface(true);

    const warRoomOnly = [...warRooms].filter((s) => !practice.has(s));
    expect(warRoomOnly.length).toBeGreaterThan(0);
    expect(warRoomOnly.sort()).toEqual(["energy", "manufacturing", "technology"]);
  });

  it("is independent of the category axis", () => {
    // The reason sector is its own column. If every question's sector could be
    // read off its category, one dropdown would have done — these are the rows
    // that prove otherwise: a technique category holding several industries.
    const byCategory = new Map<string, Set<string>>();
    for (const q of seedQuestions) {
      const seen = byCategory.get(q.category) ?? new Set<string>();
      seen.add(q.sector);
      byCategory.set(q.category, seen);
    }
    const spanning = [...byCategory.values()].filter((sectors) => sectors.size > 1);
    expect(spanning.length).toBeGreaterThan(0);
  });
});

describe("the categories a surface can actually show", () => {
  it("has at least one category holding only war rooms", () => {
    // This is the bug `listCategories(surface)` exists for: every war room is
    // filed under `product-management` and no practice question is, so a
    // surface-blind list offered it on /library as a filter that could only
    // ever return nothing. If this stops being true the guard is still correct,
    // but the regression it was written against is gone — and the test should
    // be re-read rather than deleted.
    const simulationOnly = seedCategories.filter((c) => {
      const inCategory = seedQuestions.filter((q) => q.category === c.slug);
      return (
        inCategory.length > 0 && inCategory.every((q) => isSimulation(q.type ?? "guesstimate"))
      );
    });
    expect(simulationOnly.map((c) => c.slug)).toContain("product-management");
  });

  it("leaves a category holding both kinds visible to both surfaces", () => {
    // `finance` carries three war rooms and a guesstimate, so it must survive
    // the filter on either surface — the guard drops empty categories, not
    // shared ones.
    const finance = seedQuestions.filter((q) => q.category === "finance");
    expect(finance.some((q) => isSimulation(q.type ?? "guesstimate"))).toBe(true);
    expect(finance.some((q) => !isSimulation(q.type ?? "guesstimate"))).toBe(true);
  });
});

describe("sector in the authoring contract", () => {
  const row = (over: Record<string, unknown> = {}) => ({
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

  it("accepts a known sector and carries it to the column", () => {
    const parsed = questionImportSchema.parse(row({ sector: "financial-services" }));
    expect(toQuestionColumns(parsed).sector).toBe("financial-services");
  });

  it("rejects a sector outside the vocabulary", () => {
    expect(questionImportSchema.safeParse(row({ sector: "crypto" })).success).toBe(false);
  });

  it("treats a missing or blank sector as unset rather than invalid", () => {
    // Every CSV written before the column existed has to keep importing, so
    // absence is a question with no sector, not a failed row.
    for (const value of [undefined, ""]) {
      const parsed = questionImportSchema.parse(row({ sector: value }));
      expect(toQuestionColumns(parsed).sector).toBeNull();
    }
  });
});

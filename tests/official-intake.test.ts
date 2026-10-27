import { describe, expect, it } from "vitest";
import status from "../src/data/official-source-status.json";
import { officialIntakeSchema } from "../src/domain/official-intake";

describe("official intake publication boundary", () => {
  const copy = () => structuredClone(status);
  it("accounts for both counties and all archived source pages", () => {
    const intake = officialIntakeSchema.parse(status);
    expect(intake.counties.map((c) => c.county).sort()).toEqual([
      "harris",
      "travis",
    ]);
    expect(intake.counties.reduce((n, c) => n + c.sources.length, 0)).toBe(58);
    expect(
      intake.counties.reduce(
        (n, c) => n + c.sources.reduce((sum, s) => sum + s.pageCount, 0),
        0,
      ),
    ).toBe(317);
    expect(
      intake.counties.every((c) =>
        c.sources.filter((s) => s.kind === "master_ballot" || s.kind === "write_ins").every((s) => s.pageCount === s.pagesWithText),
      ),
    ).toBe(true);
    expect(intake.counties.reduce((n, c) => n + c.stagedContestCount, 0)).toBe(
      314,
    );
    expect(
      intake.counties.reduce((n, c) => n + c.stagedCandidateCount, 0),
    ).toBe(655);
    expect(intake.counties.reduce((n, c) => n + c.stagedMeasureCount, 0)).toBe(131);
    expect(intake.counties.reduce((n, c) => n + c.matchedWriteInCount, 0)).toBe(25);
    expect(intake.counties.reduce((n, c) => n + c.cancellationScopeCount, 0)).toBe(82);
    expect(intake.counties.every((c) => c.sourceChoiceCount === c.assignedChoiceCount)).toBe(true);
    expect(intake.counties.find((c) => c.county === "travis")!.scopeSupportedMeasureCount).toBe(4);
    expect(intake.counties.find((c) => c.county === "travis")!.corroboratedCancellationScopeCount).toBe(1);
  });
  it("does not expose unreviewed candidate records or transcript text in the public artifact", () => {
    const serialized = JSON.stringify(status);
    expect(serialized).not.toContain("printedName");
    expect(serialized).not.toContain("rawLines");
    expect(serialized).not.toContain("wordingByLanguage");
    expect(serialized).not.toContain("ocrText");
    expect(serialized).not.toContain("declaredWriteIns");
    expect(serialized).not.toContain("JAMES TALARICO");
    expect(serialized).not.toContain("Ken Paxton");
  });
  it.each(["approved", "officially_verified", "complete"])(
    "rejects an unsupported public status: %s",
    (value) => {
      const data = copy();
      data.counties[0].status = value;
      expect(officialIntakeSchema.safeParse(data).success).toBe(false);
    },
  );
  it("rejects missing Harris supplemental documents", () => {
    const data = copy();
    data.counties.find((c) => c.county === "harris")!.sources.pop();
    expect(officialIntakeSchema.safeParse(data).success).toBe(false);
  });
  it("rejects duplicate counties and impossible page coverage", () => {
    const data = copy();
    data.counties[1] = data.counties[0];
    expect(officialIntakeSchema.safeParse(data).success).toBe(false);
    const other = copy();
    other.counties[0].sources[0].pagesWithText = 9999;
    expect(officialIntakeSchema.safeParse(other).success).toBe(false);
  });
  it("requires a reconciliation outcome for every notice and accounts for unassigned choices", () => {
    const data = copy();
    data.counties[0].cancellationScopeCount += 1;
    expect(officialIntakeSchema.safeParse(data).success).toBe(false);
    const other = copy();
    other.counties[0].assignedChoiceCount -= 1;
    expect(officialIntakeSchema.safeParse(other).success).toBe(false);
    other.counties[0].status = "failed";
    expect(officialIntakeSchema.safeParse(other).success).toBe(true);
  });
});

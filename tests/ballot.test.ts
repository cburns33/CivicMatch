import { describe, expect, it } from "vitest";
import { fixtureBallots } from "../src/data/fixtures";
import { ballotDatasetSchema, contestsForStyle } from "../src/domain/ballot";

describe("ballot dataset integrity", () => {
  const copy = () => structuredClone(fixtureBallots);
  it("includes every assigned contest despite missing candidate research", () => {
    expect(ballotDatasetSchema.safeParse(fixtureBallots).success).toBe(true);
    for (const city of ["austin", "houston"]) {
      const contests = contestsForStyle(fixtureBallots, `${city}-style`);
      expect(contests).toHaveLength(10);
      expect(new Set(contests.map((c) => c.officeType)).size).toBe(10);
      expect(contests.every((c) => c.researchStatus === "not_started")).toBe(
        true,
      );
    }
  });
  it("preserves printed names independently from normalized identities", () => {
    const entry = fixtureBallots.entries[0];
    expect(entry.printedName).toBe("Example Candidate 01A");
    expect(
      fixtureBallots.candidates.find((c) => c.id === entry.candidateId)
        ?.normalizedName,
    ).toBe("example candidate 01a");
  });
  it("retains write-ins and uncontested races", () => {
    expect(
      fixtureBallots.entries.some((e) => e.entryType === "qualified_write_in"),
    ).toBe(true);
    expect(
      fixtureBallots.entries.filter((e) => e.contestId === "austin-contest-7"),
    ).toHaveLength(1);
  });
  it("retains exact proposition text and options", () => {
    const wording = fixtureBallots.measures[0].exactWording;
    expect(
      ballotDatasetSchema.parse(fixtureBallots).measures[0].exactWording,
    ).toBe(wording);
    expect(fixtureBallots.measures[0].responseOptions).toEqual([
      "For",
      "Against",
    ]);
  });
  it.each([
    [
      "duplicate contest IDs",
      (d: ReturnType<typeof copy>) => d.contests.push(d.contests[0]),
    ],
    [
      "duplicate candidate entries",
      (d: ReturnType<typeof copy>) =>
        d.entries.push({ ...d.entries[0], id: "another-entry" }),
    ],
    [
      "duplicate ballot links",
      (d: ReturnType<typeof copy>) =>
        d.contestBallotStyles.push(d.contestBallotStyles[0]),
    ],
    [
      "duplicate style order",
      (d: ReturnType<typeof copy>) => {
        d.contestBallotStyles[1].order = 1;
      },
    ],
    [
      "unknown candidate",
      (d: ReturnType<typeof copy>) => {
        d.entries[0].candidateId = "missing";
      },
    ],
    [
      "missing candidate entries",
      (d: ReturnType<typeof copy>) => {
        d.entries = d.entries.filter((e) => e.contestId !== "austin-contest-0");
      },
    ],
    [
      "missing proposition wording",
      (d: ReturnType<typeof copy>) => {
        d.measures = [];
      },
    ],
    [
      "orphan district",
      (d: ReturnType<typeof copy>) => {
        d.contests[0].districtId = "missing";
      },
    ],
    [
      "orphan ballot style",
      (d: ReturnType<typeof copy>) => {
        d.contestBallotStyles[0].ballotStyleId = "missing";
      },
    ],
    [
      "unassigned contest",
      (d: ReturnType<typeof copy>) => {
        d.contestBallotStyles = d.contestBallotStyles.filter(
          (l) => l.contestId !== "austin-contest-0",
        );
      },
    ],
    [
      "mixed official and fixture sources",
      (d: ReturnType<typeof copy>) => {
        d.contests[0].provenance.sourceKind = "official";
      },
    ],
    [
      "fixture verification claim",
      (d: ReturnType<typeof copy>) => {
        d.ballotStyles[0].verification = "officially_verified";
      },
    ],
    [
      "fixture completeness claim",
      (d: ReturnType<typeof copy>) => {
        d.ballotStyles[0].completeness = "complete";
      },
    ],
  ] as const)("rejects %s", (_, mutate) => {
    const data = copy();
    mutate(data);
    expect(ballotDatasetSchema.safeParse(data).success).toBe(false);
  });
  it("rejects a cross-election contest assignment", () => {
    const data = copy();
    data.elections.push({ ...data.elections[0], id: "another-election" });
    data.ballotStyles[0].electionId = "another-election";
    expect(ballotDatasetSchema.safeParse(data).success).toBe(false);
  });
  it("rejects unknown styles instead of returning a misleading empty ballot", () => {
    expect(() => contestsForStyle(fixtureBallots, "missing")).toThrow(
      "Unknown ballot style",
    );
  });
});

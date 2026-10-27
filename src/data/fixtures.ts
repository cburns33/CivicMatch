import { ballotDatasetSchema, type BallotDataset } from "../domain/ballot";

// Synthetic test records. No names, districts, propositions, or eligibility claims
// in this module are transcribed from an official election source.
const provenance = (key: string) => ({
  sourceDocumentId: "fixture-document-v1",
  ingestionRunId: "fixture-run-v1",
  sourceRecordKey: key,
  sourceKind: "fixture" as const,
  version: 1,
});
const definitions = [
  ["federal", "U.S. Representative", "Federal offices"],
  ["statewide", "Statewide executive office", "State offices"],
  ["state_legislative", "State Representative", "State offices"],
  ["judicial", "District Judge", "Judicial offices"],
  ["county", "County Commissioner", "County offices"],
  ["city", "City Council Member", "City offices"],
  ["school_board", "School Board Trustee", "Schools & districts"],
  ["appraisal_district", "Appraisal District Director", "Schools & districts"],
  ["special_district", "Special District Director", "Schools & districts"],
  ["proposition", "Example Proposition A", "Ballot measures"],
] as const;

function createFixtures(): BallotDataset {
  const data: BallotDataset = {
    fixture: true,
    version: "fixture-v1",
    elections: [
      {
        id: "election-2026",
        name: "General & special election",
        date: "2026-11-03",
        provenance: provenance("election"),
      },
    ],
    jurisdictions: [],
    districts: [],
    ballotStyles: [],
    contests: [],
    candidates: [],
    entries: [],
    measures: [],
    contestBallotStyles: [],
  };
  for (const city of ["austin", "houston"] as const) {
    const name = city === "austin" ? "Austin" : "Houston";
    // City labels select demonstration datasets. They do not resolve a county.
    data.jurisdictions.push({
      id: `${city}-demo`,
      name: `${name} demonstration jurisdiction`,
      kind: "city",
      provenance: provenance(`${city}-jurisdiction`),
    });
    data.ballotStyles.push({
      id: `${city}-style`,
      electionId: "election-2026",
      jurisdictionId: `${city}-demo`,
      code: `${city.toUpperCase()}-DEMO-01`,
      city,
      verification: "fixture",
      completeness: "unknown",
      provenance: provenance(`${city}-style`),
    });
    definitions.forEach(([officeType, title], i) => {
      const contestId = `${city}-contest-${i}`;
      data.contests.push({
        id: contestId,
        electionId: "election-2026",
        jurisdictionId: `${city}-demo`,
        districtId: null,
        title,
        officeType,
        kind: officeType === "proposition" ? "measure" : "candidate",
        electionType: officeType === "special_district" ? "special" : "general",
        seats: 1,
        researchStatus: "not_started",
        provenance: provenance(contestId),
      });
      data.contestBallotStyles.push({
        contestId,
        ballotStyleId: `${city}-style`,
        order: i + 1,
      });
      if (officeType === "proposition") {
        data.measures.push({
          id: `${contestId}-measure`,
          contestId,
          printedTitle: title,
          exactWording:
            "SYNTHETIC FIXTURE: Shall the example district authorize the example public facilities project? This text is test wording and does not describe a real proposition.",
          responseOptions: ["For", "Against"],
          provenance: provenance(`${contestId}-measure`),
        });
      } else {
        // Includes an uncontested race and a qualified write-in edge case.
        const count = officeType === "appraisal_district" ? 1 : 2;
        for (let j = 0; j < count; j++) {
          const candidateId = `${contestId}-person-${j}`;
          const printedName = `Example Candidate ${String(i + 1).padStart(2, "0")}${j === 0 ? "A" : "B"}`;
          data.candidates.push({
            id: candidateId,
            normalizedName: printedName.toLocaleLowerCase("en-US"),
            provenance: provenance(candidateId),
          });
          data.entries.push({
            id: `${candidateId}-entry`,
            contestId,
            candidateId,
            printedName,
            ballotOrder: j + 1,
            entryType:
              officeType === "federal" && j === 1
                ? "qualified_write_in"
                : "printed",
            status: "active",
            provenance: provenance(`${candidateId}-entry`),
          });
        }
      }
    });
  }
  return ballotDatasetSchema.parse(data);
}
export const fixtureBallots = createFixtures();

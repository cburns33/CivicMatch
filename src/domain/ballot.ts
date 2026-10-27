import { z } from "zod";

export const officeTypes = [
  "federal",
  "statewide",
  "state_legislative",
  "judicial",
  "county",
  "city",
  "school_board",
  "appraisal_district",
  "special_district",
  "proposition",
] as const;
const id = z.string().min(1);
export const provenanceSchema = z.object({
  sourceDocumentId: id,
  ingestionRunId: id,
  sourceRecordKey: id,
  sourceKind: z.enum(["fixture", "official"]),
  version: z.number().int().positive(),
});
export const jurisdictionSchema = z.object({
  id,
  name: z.string().min(1),
  kind: z.enum(["federal", "state", "county", "city", "school", "special"]),
  provenance: provenanceSchema,
});
export const districtSchema = z.object({
  id,
  jurisdictionId: id,
  name: z.string().min(1),
  provenance: provenanceSchema,
});
export const electionSchema = z.object({
  id,
  name: z.string().min(1),
  date: z.iso.date(),
  provenance: provenanceSchema,
});
export const ballotStyleSchema = z.object({
  id,
  electionId: id,
  jurisdictionId: id,
  code: z.string().min(1),
  city: z.enum(["austin", "houston"]),
  verification: z.enum(["fixture", "unverified", "officially_verified"]),
  completeness: z.enum(["unknown", "partial", "complete"]),
  provenance: provenanceSchema,
});
export const contestSchema = z
  .object({
    id,
    electionId: id,
    jurisdictionId: id,
    districtId: id.nullable(),
    title: z.string().min(1),
    officeType: z.enum(officeTypes),
    kind: z.enum(["candidate", "measure"]),
    electionType: z.enum(["general", "special", "runoff"]),
    seats: z.number().int().positive(),
    researchStatus: z.enum(["not_started", "in_review", "reviewed"]),
    provenance: provenanceSchema,
  })
  .superRefine((v, ctx) => {
    if ((v.kind === "measure") !== (v.officeType === "proposition"))
      ctx.addIssue({
        code: "custom",
        message: "Measure contests must have proposition office type.",
      });
  });
export const candidateSchema = z.object({
  id,
  normalizedName: z.string().min(1),
  provenance: provenanceSchema,
});
export const entrySchema = z.object({
  id,
  contestId: id,
  candidateId: id,
  printedName: z.string().min(1),
  ballotOrder: z.number().int().positive(),
  entryType: z.enum(["printed", "qualified_write_in"]),
  status: z.enum(["active", "withdrawn", "disqualified"]),
  provenance: provenanceSchema,
});
export const measureSchema = z.object({
  id,
  contestId: id,
  printedTitle: z.string().min(1),
  exactWording: z.string().min(1),
  responseOptions: z.array(z.string().min(1)).min(2),
  provenance: provenanceSchema,
});
export const contestBallotStyleSchema = z.object({
  contestId: id,
  ballotStyleId: id,
  order: z.number().int().positive(),
});

export const ballotDatasetSchema = z
  .object({
    fixture: z.boolean(),
    version: z.string().min(1),
    jurisdictions: z.array(jurisdictionSchema),
    districts: z.array(districtSchema),
    elections: z.array(electionSchema),
    ballotStyles: z.array(ballotStyleSchema),
    contests: z.array(contestSchema),
    candidates: z.array(candidateSchema),
    entries: z.array(entrySchema),
    measures: z.array(measureSchema),
    contestBallotStyles: z.array(contestBallotStyleSchema),
  })
  .superRefine((data, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    const unique = (values: string[], label: string) => {
      if (new Set(values).size !== values.length) issue(`Duplicate ${label}.`);
    };
    for (const key of [
      "jurisdictions",
      "districts",
      "elections",
      "ballotStyles",
      "contests",
      "candidates",
      "entries",
      "measures",
    ] as const)
      unique(
        data[key].map((v) => v.id),
        `${key} id`,
      );
    const has = (rows: { id: string }[], value: string) =>
      rows.some((v) => v.id === value);
    unique(
      data.ballotStyles.map(
        (v) => `${v.electionId}:${v.jurisdictionId}:${v.code}`,
      ),
      "ballot style code",
    );
    unique(
      data.entries.map((v) => `${v.contestId}:${v.candidateId}`),
      "candidate contest entry",
    );
    unique(
      data.entries.map((v) => `${v.contestId}:${v.ballotOrder}`),
      "candidate ballot order",
    );
    unique(
      data.measures.map((v) => v.contestId),
      "measure contest",
    );
    unique(
      data.contestBallotStyles.map((v) => `${v.contestId}:${v.ballotStyleId}`),
      "contest ballot style",
    );
    unique(
      data.contestBallotStyles.map((v) => `${v.ballotStyleId}:${v.order}`),
      "contest order",
    );
    for (const row of data.districts)
      if (!has(data.jurisdictions, row.jurisdictionId))
        issue("District has unknown jurisdiction.");
    for (const row of [...data.ballotStyles, ...data.contests]) {
      if (!has(data.elections, row.electionId)) issue("Unknown election.");
      if (!has(data.jurisdictions, row.jurisdictionId))
        issue("Unknown jurisdiction.");
    }
    for (const row of data.contests) {
      if (
        row.districtId &&
        !data.districts.some(
          (d) =>
            d.id === row.districtId && d.jurisdictionId === row.jurisdictionId,
        )
      )
        issue("Contest district belongs to another jurisdiction.");
      if (
        row.kind === "measure" &&
        !data.measures.some((m) => m.contestId === row.id)
      )
        issue("Measure contest lacks exact wording.");
      if (
        row.kind === "candidate" &&
        !data.entries.some((e) => e.contestId === row.id)
      )
        issue("Candidate contest has no entries; import requires review.");
      if (!data.contestBallotStyles.some((link) => link.contestId === row.id))
        issue("Contest is missing a ballot style.");
    }
    for (const row of data.entries) {
      if (!has(data.candidates, row.candidateId))
        issue("Entry has unknown candidate.");
      if (
        !data.contests.some(
          (c) => c.id === row.contestId && c.kind === "candidate",
        )
      )
        issue("Entry requires a candidate contest.");
    }
    for (const row of data.measures)
      if (
        !data.contests.some(
          (c) => c.id === row.contestId && c.kind === "measure",
        )
      )
        issue("Measure requires a measure contest.");
    for (const row of data.contestBallotStyles) {
      const contest = data.contests.find((c) => c.id === row.contestId);
      const style = data.ballotStyles.find((s) => s.id === row.ballotStyleId);
      if (!contest || !style) issue("Unknown contest or ballot style.");
      else if (contest.electionId !== style.electionId)
        issue("Contest and ballot style must share an election.");
    }
    for (const key of [
      "jurisdictions",
      "districts",
      "elections",
      "ballotStyles",
      "contests",
      "candidates",
      "entries",
      "measures",
    ] as const) {
      for (const row of data[key])
        if (data.fixture !== (row.provenance.sourceKind === "fixture"))
          issue("Fixture and official provenance must not be mixed.");
    }
    if (
      data.fixture &&
      data.ballotStyles.some(
        (s) => s.verification !== "fixture" || s.completeness !== "unknown",
      )
    )
      issue(
        "Fixture ballots cannot claim official verification or completeness.",
      );
  });

export type BallotDataset = z.infer<typeof ballotDatasetSchema>;
export type Contest = z.infer<typeof contestSchema>;
export type BallotStyle = z.infer<typeof ballotStyleSchema>;
export type CandidateContestEntry = z.infer<typeof entrySchema>;
export function contestsForStyle(
  data: BallotDataset,
  styleId: string,
): Contest[] {
  if (!data.ballotStyles.some((s) => s.id === styleId))
    throw new Error("Unknown ballot style");
  return data.contestBallotStyles
    .filter((l) => l.ballotStyleId === styleId)
    .sort((a, b) => a.order - b.order)
    .map((l) => data.contests.find((c) => c.id === l.contestId)!);
}

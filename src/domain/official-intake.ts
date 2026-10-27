import { z } from "zod";
import { checksumSchema } from "./provenance";

const sourceSchema = z
  .object({
    county: z.enum(["travis", "harris"]),
    kind: z.enum(["master_ballot", "write_ins", "cancellations", "supporting_reference"]),
    title: z.string().min(1),
    discoveryUrl: z.url(),
    discoverySha256: checksumSchema,
    url: z.url(),
    sha256: checksumSchema,
    bytes: z.number().int().positive(),
    mediaType: z.enum(["application/pdf", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]),
    checksumScope: z.literal("document_bytes"),
    retrievedAt: z.iso.datetime({ offset: true }),
    pageCount: z.number().int().positive(),
    pagesWithText: z.number().int().nonnegative(),
    pagesWithOcr: z.number().int().nonnegative(),
    extractionScope: z.enum(["all_pages", "targeted_first_page", "filtered_workbook"]),
  })
  .refine(
    (source) => source.pagesWithText <= source.pageCount && source.pagesWithOcr <= source.pageCount,
    "Text coverage cannot exceed the page count.",
  )
  .refine(
    (source) => source.mediaType === "application/pdf" ? source.extractionScope !== "filtered_workbook" :
      source.kind === "supporting_reference" && source.extractionScope === "filtered_workbook" &&
      source.url === "https://goelect.txelections.civixapps.com/ivis-cbp-ui/candidate-information",
    "Workbook evidence must be a filtered official portal reference.",
  );

export const officialIntakeSchema = z
  .object({
    schemaVersion: z.literal(2),
    electionDate: z.literal("2026-11-03"),
    counties: z
      .array(
        z.object({
          county: z.enum(["travis", "harris"]),
          electionDate: z.literal("2026-11-03"),
          runId: checksumSchema,
          adapterVersion: z.literal("county-reference-v4"),
          status: z.enum(["needs_review", "failed"]),
          referenceScope: z.literal("county_consolidated"),
          parseScope: z.literal("all_master_pages_and_supplements"),
          stagedContestCount: z.number().int().nonnegative(),
          stagedCandidateCount: z.number().int().nonnegative(),
          stagedMeasureCount: z.number().int().nonnegative(),
          declarationBlockCount: z.number().int().nonnegative(),
          sourceChoiceCount: z.number().int().nonnegative(),
          assignedChoiceCount: z.number().int().nonnegative(),
          matchedWriteInCount: z.number().int().nonnegative(),
          scopeSupportedMeasureCount: z.number().int().nonnegative(),
          corroboratedCancellationScopeCount: z.number().int().nonnegative(),
          cancellationScopeCount: z.number().int().nonnegative(),
          cancellationMatches: z.object({
            corroborates_declaration: z.number().int().nonnegative(),
            possible_active_conflict: z.number().int().nonnegative(),
            measure_only_scope: z.number().int().nonnegative(),
            no_matching_master_record: z.number().int().nonnegative(),
            scope_review_required: z.number().int().nonnegative(),
          }),
          issues: z.array(
            z.object({ code: z.string().min(1), message: z.string().min(1) }),
          ),
          sources: z.array(sourceSchema).min(1),
        }),
      )
      .length(2),
  })
  .superRefine((data, ctx) => {
    if (new Set(data.counties.map((c) => c.county)).size !== 2)
      ctx.addIssue({
        code: "custom",
        message: "Both counties must appear exactly once.",
      });
    for (const county of data.counties) {
      const kinds = county.sources.map((s) => s.kind);
      if (
        kinds.filter((kind) => kind === "master_ballot").length !== 1 ||
        kinds.filter((kind) => kind === "write_ins").length !== 1 ||
        !kinds.includes("cancellations") ||
        new Set(county.sources.map((s) => `${s.kind}:${s.sha256}:${s.title}`)).size !== county.sources.length
      )
        ctx.addIssue({
          code: "custom",
          message: "Missing or duplicate required county source.",
        });
      if (county.sources.some((source) => source.county !== county.county))
        ctx.addIssue({
          code: "custom",
          message: "Source belongs to another county.",
        });
      if (county.assignedChoiceCount > county.sourceChoiceCount ||
          county.status !== "failed" && county.assignedChoiceCount !== county.sourceChoiceCount)
        ctx.addIssue({ code: "custom", message: "Unassigned ballot choices require a failed intake status." });
      if (Object.values(county.cancellationMatches).reduce((sum, value) => sum + value, 0) !== county.cancellationScopeCount)
        ctx.addIssue({ code: "custom", message: "Every cancellation scope must have a reconciliation result." });
    }
  });
export type OfficialIntake = z.infer<typeof officialIntakeSchema>;

export const officialStyleStatusSchema = z.object({
  schemaVersion: z.literal(1),
  electionDate: z.literal("2026-11-03"),
  limitation: z.string().min(1),
  counties: z.array(z.object({
    county: z.enum(["travis", "harris"]), runId: checksumSchema,
    referenceCount: z.number().int().nonnegative(), comparisonPassedCount: z.number().int().nonnegative(),
    officiallyVerifiedCount: z.literal(0), addressFixtureCount: z.literal(0), status: z.literal("blocked"),
  })).length(2),
}).refine((s) => new Set(s.counties.map((c) => c.county)).size === 2 &&
  s.counties.every((c) => c.comparisonPassedCount <= c.referenceCount), "Invalid style comparison coverage.");

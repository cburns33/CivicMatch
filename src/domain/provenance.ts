import { z } from "zod";

export const checksumSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const sourceDocumentSchema = z
  .object({
    id: z.uuid(),
    authority: z.string().min(1),
    sourceKind: z.enum([
      "official",
      "candidate",
      "legislative",
      "media",
      "fixture",
    ]),
    url: z.url().nullable(),
    archiveReference: z.string().min(1).nullable(),
    retrievedAt: z.iso.datetime(),
    publishedAt: z.iso.datetime().nullable(),
    sha256: checksumSchema,
    checksumScope: z.enum(["document_bytes", "reference_metadata"]),
    mediaType: z.string().min(1),
  })
  .refine(
    (v) => v.url !== null || v.archiveReference !== null,
    "A source needs a URL or archive reference.",
  );
export const ingestionRunSchema = z
  .object({
    id: z.uuid(),
    sourceDocumentId: z.uuid(),
    adapter: z.string().min(1),
    adapterVersion: z.string().min(1),
    status: z.enum(["pending", "parsed", "needs_review", "approved", "failed"]),
    startedAt: z.iso.datetime(),
    finishedAt: z.iso.datetime().nullable(),
    referenceBallotChecked: z.boolean(),
    unresolvedCount: z.number().int().nonnegative(),
    reviewedBy: z.uuid().nullable(),
    validationSchemaVersion: z.number().int().positive().nullable(),
  })
  .refine(
    (v) =>
      v.status !== "approved" ||
      (v.referenceBallotChecked &&
        v.unresolvedCount === 0 &&
        v.finishedAt !== null &&
        v.reviewedBy !== null &&
        v.validationSchemaVersion !== null),
    "Approved imports require reference validation, a reviewer, a schema version, a finish time, and no unresolved issues.",
  );
export const ingestionDiffSchema = z
  .object({
    id: z.uuid(),
    ingestionRunId: z.uuid(),
    entityType: z.string().min(1),
    sourceRecordKey: z.string().min(1),
    change: z.enum(["added", "changed", "removed", "conflict", "parse_error"]),
    before: z.unknown(),
    after: z.unknown(),
    reviewRequired: z.boolean(),
  })
  .refine(
    (v) =>
      !["removed", "conflict", "parse_error"].includes(v.change) ||
      v.reviewRequired,
    "Consequential changes require review.",
  );
export const snapshotSchema = z.object({
  id: z.uuid(),
  electionId: z.uuid(),
  ingestionRunId: z.uuid(),
  version: z.number().int().positive(),
  schemaVersion: z.number().int().positive(),
  sha256: checksumSchema,
  publishedAt: z.iso.datetime(),
  payload: z.record(z.string(), z.unknown()),
});
export const correctionSchema = z.object({
  id: z.uuid(),
  snapshotId: z.uuid(),
  replacementSnapshotId: z.uuid().nullable(),
  description: z.string().min(1),
  status: z.enum(["open", "accepted", "rejected", "published"]),
  sourceDocumentId: z.uuid(),
});
export type SourceDocument = z.infer<typeof sourceDocumentSchema>;
export type IngestionRun = z.infer<typeof ingestionRunSchema>;
export type IngestionDiff = z.infer<typeof ingestionDiffSchema>;
export type PublicationSnapshot = z.infer<typeof snapshotSchema>;
export type Correction = z.infer<typeof correctionSchema>;

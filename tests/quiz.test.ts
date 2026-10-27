import { describe, expect, it } from "vitest";
import {
  importanceResponseSchema,
  policyResponseSchema,
  proposedScoringMethod,
  scoringMethodSchema,
} from "../src/domain/quiz";
import {
  ingestionRunSchema,
  sourceDocumentSchema,
} from "../src/domain/provenance";
const uuid = "00000000-0000-4000-8000-000000000001";
describe("preliminary response and methodology schemas", () => {
  it("keeps neutral, skipped, and untouched states distinct", () => {
    expect(
      policyResponseSchema.parse({
        questionVersionId: uuid,
        state: "answered",
        value: 3,
      }).value,
    ).toBe(3);
    expect(
      policyResponseSchema.parse({
        questionVersionId: uuid,
        state: "skipped",
        value: null,
      }).state,
    ).toBe("skipped");
    expect(
      policyResponseSchema.parse({
        questionVersionId: uuid,
        state: "unanswered",
        value: null,
      }).state,
    ).toBe("unanswered");
  });
  it.each([
    ["answered", null],
    ["skipped", 3],
    ["unanswered", 3],
    ["answered", 6],
    ["answered", 2.5],
  ])("rejects state %s with value %s", (state, value) => {
    expect(
      policyResponseSchema.safeParse({ questionVersionId: uuid, state, value })
        .success,
    ).toBe(false);
  });
  it("allows importance to be omitted without dropping an answer", () => {
    expect(
      importanceResponseSchema.parse({ questionVersionId: uuid, value: null })
        .value,
    ).toBeNull();
    expect(proposedScoringMethod.defaultImportanceWeight).toBe(1);
    expect(proposedScoringMethod.importanceWeights).toEqual([
      0.5, 0.75, 1, 1.5, 2,
    ]);
  });
  it("allows several independent most-important responses", () => {
    expect(
      [uuid, "00000000-0000-4000-8000-000000000002"].map((questionVersionId) =>
        importanceResponseSchema.parse({ questionVersionId, value: 5 }),
      ),
    ).toHaveLength(2);
  });
  it("rejects invalid methodology thresholds", () => {
    expect(
      scoringMethodSchema.safeParse({
        ...proposedScoringMethod,
        minimumCoverage: 1.2,
      }).success,
    ).toBe(false);
  });
  it("requires an archive or a reference and a SHA-256 checksum", () => {
    expect(
      sourceDocumentSchema.safeParse({
        id: uuid,
        authority: "Test only",
        sourceKind: "fixture",
        url: null,
        archiveReference: null,
        retrievedAt: "2026-10-26T12:00:00Z",
        publishedAt: null,
        sha256: "bad",
        checksumScope: "document_bytes",
        mediaType: "text/plain",
      }).success,
    ).toBe(false);
  });
  it("blocks approval without reference validation", () => {
    expect(
      ingestionRunSchema.safeParse({
        id: uuid,
        sourceDocumentId: uuid,
        adapter: "test",
        adapterVersion: "1",
        status: "approved",
        startedAt: "2026-10-26T12:00:00Z",
        finishedAt: null,
        referenceBallotChecked: false,
        unresolvedCount: 1,
        reviewedBy: uuid,
        validationSchemaVersion: 1,
      }).success,
    ).toBe(false);
  });
});

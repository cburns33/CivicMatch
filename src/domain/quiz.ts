import { z } from "zod";

export const policyValueSchema = z.number().int().min(1).max(5);
export const importanceValueSchema = z.number().int().min(1).max(5);
export const questionVersionSchema = z.object({
  id: z.uuid(),
  questionId: z.uuid(),
  revision: z.number().int().positive(),
  statement: z.string().min(1),
  effectiveFrom: z.iso.datetime(),
  provenanceId: z.uuid(),
});
export const policyResponseSchema = z.discriminatedUnion("state", [
  z.object({
    questionVersionId: z.uuid(),
    state: z.literal("answered"),
    value: policyValueSchema,
  }),
  z.object({
    questionVersionId: z.uuid(),
    state: z.literal("skipped"),
    value: z.null(),
  }),
  z.object({
    questionVersionId: z.uuid(),
    state: z.literal("unanswered"),
    value: z.null(),
  }),
]);
export const importanceResponseSchema = z.object({
  questionVersionId: z.uuid(),
  value: importanceValueSchema.nullable(),
});
export const scoringMethodSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  policyMin: z.literal(1),
  policyMax: z.literal(5),
  importanceWeights: z.tuple([
    z.number().positive(),
    z.number().positive(),
    z.number().positive(),
    z.number().positive(),
    z.number().positive(),
  ]),
  defaultImportanceWeight: z.number().positive(),
  minimumAnswered: z.number().int().positive(),
  minimumComparable: z.number().int().positive(),
  minimumCoverage: z.number().min(0).max(1),
  conflictRule: z.literal("exclude_unresolved"),
});
// Proposed configuration only. No scoring engine or results UI is part of M1.
export const proposedScoringMethod = scoringMethodSchema.parse({
  id: "civicmatch-weighted-distance",
  version: 1,
  policyMin: 1,
  policyMax: 5,
  importanceWeights: [0.5, 0.75, 1, 1.5, 2],
  defaultImportanceWeight: 1,
  minimumAnswered: 5,
  minimumComparable: 5,
  minimumCoverage: 0.6,
  conflictRule: "exclude_unresolved",
});
export type PolicyResponse = z.infer<typeof policyResponseSchema>;
export type ImportanceResponse = z.infer<typeof importanceResponseSchema>;
export type QuestionVersion = z.infer<typeof questionVersionSchema>;
export type ScoringMethod = z.infer<typeof scoringMethodSchema>;

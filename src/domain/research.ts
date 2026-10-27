import { z } from "zod";
import { policyValueSchema } from "./quiz";

export const evidenceMethodologyVersion = "evidence-review-v1";
export const claimKinds = [
  {
    value: "documented_action",
    label: "Documented action",
    description:
      "What a candidate did, with the date, exact action, legislative stage, and scope recorded.",
  },
  {
    value: "recorded_statement",
    label: "Recorded statement",
    description:
      "What a candidate said, with a source, date, and context. A stated reason is attributed to the candidate.",
  },
  {
    value: "insider_interpretation",
    label: "Insider interpretation",
    description:
      "An attributed account of how political participants understood an action, including the source’s perspective and basis of knowledge.",
  },
  {
    value: "inferred_motive",
    label: "Inferred motive",
    description:
      "An explanation of why a candidate acted, with supporting evidence, alternative explanations, and limits kept visible.",
  },
] as const;
export const evidenceConfidenceLevels = [
  {
    value: "strong",
    label: "Strong support",
    description:
      "Verified evidence bears directly on this specific claim, and material contradictions have been resolved.",
  },
  {
    value: "qualified",
    label: "Qualified support",
    description:
      "Verified evidence supports the claim, with limits in scope, directness, or context that require an explanation.",
  },
  {
    value: "limited",
    label: "Limited support",
    description:
      "Support has material gaps, uncorroborated secondhand accounts, unverified material, or unresolved conflicts.",
  },
  {
    value: "unassessed",
    label: "Unassessed",
    description:
      "An evidence assessment has not been completed. No confidence claim is made.",
  },
] as const;

// Preliminary review DTO. No intake, persistence, publication, or scorer uses it yet.
// These checks establish minimum evidence requirements; reviewers assess meaning.
export const claimAssessmentSchema = z
  .object({
    methodologyVersion: z.literal(evidenceMethodologyVersion),
    kind: z.enum([
      "documented_action",
      "recorded_statement",
      "insider_interpretation",
      "inferred_motive",
    ]),
    claim: z.string().trim().min(1),
    attribution: z.string().trim().min(1).nullable(),
    evidenceConfidence: z.enum([
      "strong",
      "qualified",
      "limited",
      "unassessed",
    ]),
    reviewerConfidence: z.enum(["high", "medium", "low"]).nullable(),
    explanation: z.string().trim().min(1),
    limitations: z.array(z.string().trim().min(1)),
    alternativeExplanations: z.array(z.string().trim().min(1)),
    unresolvedConflict: z.boolean(),
    support: z.array(
      z.object({
        evidenceId: z.uuid(),
        basis: z.enum([
          "primary_record",
          "firsthand_account",
          "secondhand_account",
        ]),
        verified: z.boolean(),
        relevance: z.enum(["direct", "contextual"]),
      }),
    ),
  })
  .superRefine((assessment, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    if (
      new Set(assessment.support.map((s) => s.evidenceId)).size !==
      assessment.support.length
    )
      issue("An evidence reference cannot be counted twice.");
    if (
      assessment.evidenceConfidence !== "unassessed" &&
      assessment.support.length === 0
    )
      issue("An assessed confidence label requires supporting evidence.");
    if (
      assessment.kind === "insider_interpretation" &&
      assessment.attribution === null
    )
      issue(
        "Insider interpretations require attribution and the source’s perspective in context.",
      );
    if (
      assessment.kind === "inferred_motive" &&
      (assessment.alternativeExplanations.length === 0 ||
        assessment.limitations.length === 0)
    )
      issue(
        "Motive inferences require alternative explanations and limitations.",
      );
    if (["strong", "qualified"].includes(assessment.evidenceConfidence)) {
      if (assessment.unresolvedConflict)
        issue(
          "Unresolved material conflicts require limited support or an unassessed label.",
        );
      if (
        !assessment.support.some(
          (s) => s.verified && s.basis !== "secondhand_account",
        )
      )
        issue(
          "Strong or qualified support requires verified primary evidence or a firsthand account; secondhand accounts alone remain limited.",
        );
    }
    if (
      assessment.evidenceConfidence === "strong" &&
      !assessment.support.some(
        (s) =>
          s.verified &&
          s.relevance === "direct" &&
          s.basis !== "secondhand_account",
      )
    )
      issue(
        "Strong support requires verified primary evidence or a direct firsthand account relevant to the claim.",
      );
  });
export type ClaimAssessment = z.infer<typeof claimAssessmentSchema>;

export const evidenceSchema = z
  .object({
    id: z.uuid(),
    candidateId: z.uuid(),
    questionVersionId: z.uuid(),
    sourceDocumentId: z.uuid(),
    sourceType: z.enum([
      "recorded_vote",
      "public_statement",
      "interpretation",
      "judicial_record",
    ]),
    excerpt: z.string().min(1),
    eventDate: z.iso.date().nullable(),
    interpretation: z.string().nullable(),
    supersedesEvidenceId: z.uuid().nullable(),
  })
  .refine(
    (v) =>
      v.sourceType !== "interpretation" || Boolean(v.interpretation?.trim()),
    "Interpretations need an explanation.",
  );
export const reviewSchema = z.object({
  id: z.uuid(),
  evidenceId: z.uuid(),
  reviewerId: z.uuid(),
  decision: z.enum(["approved", "rejected", "needs_revision"]),
  reason: z.string().min(1),
  reviewedAt: z.iso.datetime(),
});
export const candidatePositionSchema = z.object({
  id: z.uuid(),
  candidateId: z.uuid(),
  questionVersionId: z.uuid(),
  stance: policyValueSchema,
  conflictStatus: z.enum([
    "none",
    "resolved",
    "time_dependent",
    "ambiguous",
    "unresolved",
  ]),
  explanation: z.string().min(1),
  reviewId: z.uuid(),
  evidenceIds: z.array(z.uuid()).min(1),
});
export type EvidenceRecord = z.infer<typeof evidenceSchema>;
export type ResearchReview = z.infer<typeof reviewSchema>;
export type CandidatePosition = z.infer<typeof candidatePositionSchema>;

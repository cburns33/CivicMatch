import { describe, expect, it } from "vitest";
import {
  claimAssessmentSchema,
  evidenceMethodologyVersion,
  type ClaimAssessment,
} from "../src/domain/research";

const example = (): ClaimAssessment => ({
  methodologyVersion: evidenceMethodologyVersion,
  kind: "documented_action",
  claim: "Synthetic example: a recorded committee vote.",
  attribution: null,
  evidenceConfidence: "strong",
  reviewerConfidence: "high",
  explanation: "The verified record identifies the vote and legislative stage.",
  limitations: [],
  alternativeExplanations: [],
  unresolvedConflict: false,
  support: [
    {
      evidenceId: "00000000-0000-4000-8000-000000000001",
      basis: "primary_record",
      verified: true,
      relevance: "direct",
    },
  ],
});

describe("claim-specific evidence assessment", () => {
  it("accepts a documented action with verified direct evidence", () => {
    expect(claimAssessmentSchema.safeParse(example()).success).toBe(true);
  });
  it("keeps reviewer certainty separate from limited secondhand support", () => {
    const assessment = example();
    Object.assign(assessment, {
      kind: "insider_interpretation",
      attribution:
        "Synthetic reviewer, campaign consultant; retrospective secondhand account.",
      evidenceConfidence: "limited",
    });
    assessment.support[0].basis = "secondhand_account";
    const result = claimAssessmentSchema.parse(assessment);
    expect(result.reviewerConfidence).toBe("high");
    expect(result.evidenceConfidence).toBe("limited");
  });
  it.each(["strong", "qualified"] as const)(
    "does not upgrade repeated secondhand accounts to %s support",
    (evidenceConfidence) => {
      const assessment = example();
      assessment.evidenceConfidence = evidenceConfidence;
      assessment.support[0].basis = "secondhand_account";
      assessment.support.push({
        ...assessment.support[0],
        evidenceId: "00000000-0000-4000-8000-000000000002",
      });
      expect(claimAssessmentSchema.safeParse(assessment).success).toBe(false);
    },
  );
  it("requires attribution for insider interpretations", () => {
    expect(
      claimAssessmentSchema.safeParse({
        ...example(),
        kind: "insider_interpretation",
      }).success,
    ).toBe(false);
  });
  it("requires alternatives and limitations for inferred motives", () => {
    expect(
      claimAssessmentSchema.safeParse({ ...example(), kind: "inferred_motive" })
        .success,
    ).toBe(false);
    expect(
      claimAssessmentSchema.safeParse({
        ...example(),
        kind: "inferred_motive",
        evidenceConfidence: "limited",
        limitations: ["The action alone does not establish intent."],
        alternativeExplanations: [
          "Another policy objective may explain the action.",
        ],
      }).success,
    ).toBe(true);
  });
  it.each(["strong", "qualified"] as const)(
    "rejects %s support with unresolved conflict",
    (evidenceConfidence) => {
      expect(
        claimAssessmentSchema.safeParse({
          ...example(),
          evidenceConfidence,
          unresolvedConflict: true,
        }).success,
      ).toBe(false);
    },
  );
  it("requires direct claim support for the strongest label", () => {
    const assessment = example();
    assessment.support[0].relevance = "contextual";
    expect(claimAssessmentSchema.safeParse(assessment).success).toBe(false);
    assessment.evidenceConfidence = "qualified";
    expect(claimAssessmentSchema.safeParse(assessment).success).toBe(true);
  });
  it.each(["strong", "qualified"] as const)(
    "requires verified evidence for %s support",
    (evidenceConfidence) => {
      const assessment = example();
      assessment.evidenceConfidence = evidenceConfidence;
      assessment.support[0].verified = false;
      expect(claimAssessmentSchema.safeParse(assessment).success).toBe(false);
    },
  );
  it("requires references for assessed confidence and rejects duplicate evidence", () => {
    expect(
      claimAssessmentSchema.safeParse({ ...example(), support: [] }).success,
    ).toBe(false);
    const assessment = example();
    assessment.support.push(assessment.support[0]);
    expect(claimAssessmentSchema.safeParse(assessment).success).toBe(false);
  });
  it("preserves an explicit unassessed state without fabricating confidence", () => {
    expect(
      claimAssessmentSchema.safeParse({
        ...example(),
        evidenceConfidence: "unassessed",
        reviewerConfidence: null,
        support: [],
        explanation: "Awaiting source review.",
      }).success,
    ).toBe(true);
  });
});

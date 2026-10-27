# Candidate evidence review standard, version 1

Identifier: `evidence-review-v1`. Adopted October 26, 2026. This standard is published on the methodology page. M1 has a preliminary validated assessment DTO, with no research intake, database persistence, publication service, or scoring engine using it. The synthetic preview publishes no real candidate assessments.

## Separate the claims

| Claim category | What is recorded | What requires separate support |
| --- | --- | --- |
| Documented action | The exact vote, amendment, sponsorship, decision, or other action, with date, version, scope, and legislative stage | Its mapping to a policy question, strategic effect, credit allocation, and motive |
| Recorded statement | An attributable statement, date, source, and context, including a candidate's stated reason | Whether the explanation establishes the actual motive or matches the candidate's actions |
| Insider interpretation | An attributed interpretation or report of political perceptions, with the source's role, perspective, access, and basis of knowledge | How representative the perception was, whether reports are independent, and whether the inferred explanation is true |
| Inferred motive | A proposed explanation for why a candidate acted, with supporting evidence, alternatives, and limitations | The candidate's actual intention and any claim that one explanation excludes others |

A claim that a perception existed in a political circle and a claim that the candidate acted for that reason are separate assessments. Verified attribution can substantiate what a source reported. Reviewers must assess how the evidence bears on the underlying allegation. A candidate's account of their own motive remains an attributed statement.

Record insiders' professional roles, relevant affiliations, access, and perspective as source context. Distinguish firsthand observation, secondhand chatter, and retrospective recollection. Apply the same standard across parties. Expertise helps evaluate context; credentials and affiliation alone cannot establish confidence in a claim.

## Evidence confidence and reviewer certainty

| Evidence-confidence label | Standard |
| --- | --- |
| Strong support | Verified primary evidence or a verified firsthand account bears directly on the specific claim. Material contradictions are resolved. Review explains authenticity, scope, and remaining limits. |
| Qualified support | Verified primary evidence or firsthand accounts support the claim, with stated limits in directness, scope, corroboration, or context. Material contradictions are resolved. |
| Limited support | Support has material gaps, rests on uncorroborated secondhand accounts or unverified material, or has unresolved material conflicts. |
| Unassessed | Source review is incomplete. No confidence claim is made. |

Each assessment records source/evidence references, claim-specific directness, source verification, a supporting explanation, limitations, conflicts, and the review-method version. Inferred motives require alternative explanations and limitations. Insider interpretations require attribution, including the source's perspective and knowledge basis in context. Reviewer certainty may be recorded as high, medium, low, or null in a separate field. It never upgrades evidence confidence.

These are qualitative support labels. They are not numerical probabilities, consensus percentages, source-type multipliers, or automatic stance weights. The schema enforces minimum structural requirements; human review determines whether a source supports the meaning of a claim. A source being authentic does not make every allegation within it verified.

Count independent origins, not repeated articles or retellings. Repeated secondhand accounts alone remain limited. A single authoritative primary record can provide strong support for the action it records. Evidence supporting an action cannot be transferred to its proposed motive without a separate assessment. Reviewer confidence is neither independent corroboration nor a substitute for references.

## Review sequence

1. Separate the reviewer's own policy preference from their assessment of the candidate.
2. Verify the action, statement, actors, bill/session/version, chronology, and scope. Distinguish the immediate legislative agenda from known future events.
3. Preserve attributed explanations and insider perceptions with their source context. Identify direct observations and secondhand recollections.
4. Assess the proposed policy mapping, strategy, and motive as separate claims. Identify alternative explanations, missing information, and conflicting evidence.
5. Distinguish attempted strategy, eventual outcome, and demonstrated causal effect. An unsuccessful strategy can still have been attempted; an eventual outcome alone cannot establish motive.
6. Assign a claim-specific evidence-confidence label with reasons. Preserve the review decision and source history when correcting an assessment.

## Policy matching and coverage

Policy positions require reviewed action or statement evidence mapped to the applicable question revision, with material conflicts resolved. A bill with several provisions can require interpretation before a vote supplies a structured stance. No fixed rule makes a vote worth a specified number of statements. Display the action and statement evidence with dates and discrepancies.

Insider interpretations and inferred motives stay in attributed research context. They are excluded from policy agreement and the numerator of policy-evidence coverage. Future implementation must enforce that separation when resolving the evidence set for a candidate position. M1 does not calculate scores or persist claim assessments.

Research coverage counts office-relevant questions with reviewed policy evidence divided by all office-relevant questions. Comparison coverage counts the user's applicable answered questions with reviewed candidate policy evidence divided by all their applicable answered questions. Show counts and limits for each. Repeated reporting of one issue adds no extra question coverage. Confidence concerns support for one claim and remains a separate dimension.

## Corrections and future implementation

Retain source references, dates, reviewer decisions, explanations, limitations, conflicts, and method versions. A corrected timeline can change an interpretation without resolving an unobserved motive. Publication must preserve prior versions and show what changed.

`claimAssessmentSchema` in `src/domain/research.ts` is a preliminary application contract. The existing SQL research tables remain unchanged. A later research-intake milestone must add versioned persistence, resolve referenced evidence and source independence, enforce review/publication access, and test exclusions from policy matching. The schema cannot determine whether a purported firsthand account is truthful or whether an inference is warranted.

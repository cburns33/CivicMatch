# Proposed scoring methodology, version 1

The unified issue quiz implements this weighted-distance method. It groups state and federal questions by issue and compares all available governor and Senate candidates after answer review. Each candidate uses only their office-applicable questions, with independent research and comparison denominators. On October 27 the user clarified that the audience is the user and friends and authorized sourced AI-assisted provisional candidate mappings without mandatory human approval. The quiz labels provisional results and keeps source rationale, coverage, ambiguities, and confidence separate. References below to approved candidate evidence describe the original reviewed-release design; this authorized prototype also admits versioned provisional evidence. Pending unpublished drafts, unresolved conflicts, limited evidence, and motives remain excluded. The model does not claim to reproduce iSideWith's formula.

## Inputs and states

Policy responses use 1 = strongly disagree, 2 = disagree, 3 = neutral or unsure, 4 = agree, and 5 = strongly agree. A neutral answer is substantive and eligible for comparison. An explicit skip has state `skipped` and null value. An untouched question has state `unanswered` and null value. Neither null state enters the comparison denominator.

Importance is independent of policy direction. Each question may have a five-level response or null. Multiple questions may share any level, including level 5. No fixed allocation or unique ranking is required.

| Importance | Proposed weight |
| --- | ---: |
| Null, not rated | 1.00 |
| 1, least important to me | 0.50 |
| 2, less important | 0.75 |
| 3, average importance | 1.00 |
| 4, more important | 1.50 |
| 5, most important to me | 2.00 |

The highest weight contributes four times as much as the lowest weight when both are in the same candidate denominator. An unanswered importance rating preserves the question at weight 1.00.

## Eligibility and formula

A question is applicable only when its jurisdiction and office scope include the contest. Judicial contests use qualifications and judicial-record research rather than this policy model. Measures require their own future research design and are not silently treated as candidates.

For each applicable answered question with an approved candidate stance on the same question revision:

```text
question agreement = 1 - abs(user value - candidate value) / 4
weighted agreement = sum(question agreement * importance weight)
                     / sum(importance weight)
policy agreement percent = 100 * weighted agreement
```

Identical positions yield 1.00; distances of 1, 2, 3, and 4 yield 0.75, 0.50, 0.25, and 0.00. Unreviewed evidence and unresolved or ambiguous conflicts are excluded. Time-dependent evidence requires a reviewer-approved effective context before use. Party affiliation cannot supply a stance.

The separate [evidence review standard](evidence-methodology.md), `evidence-review-v1`, distinguishes documented actions, recorded statements, insider interpretations, and inferred motives. Insider interpretations and inferred motives remain attributed context and are excluded from policy agreement and policy-evidence coverage. A policy position needs its own reviewed action or statement evidence and an explained mapping to the question. Qualitative evidence-confidence labels carry no probability or automatic scoring multiplier. Reviewer certainty and personal policy preferences remain separate from the candidate position and its evidence.

Example: answered responses 5 and 3, candidate positions 4 and 1, weights 2.00 and 0.50. Contributions are 0.75 × 2.00 and 0.50 × 0.50. Agreement is 1.75 / 2.50 = 70%. This is a numerical example using no real candidate.

## Coverage and insufficient information

```text
coverage = comparable applicable answered questions
           / all applicable answered questions
```

Report agreement, unweighted evidence coverage, included count, and applicable answered count together. Also expose weighted coverage as a separately labeled sensitivity diagnostic when implemented. A zero denominator yields an insufficient-information state, with no fabricated zero-percent score.

This is the user's comparison coverage. Research coverage uses a separate denominator: all office-relevant questions, whether the user answered them or not. It counts questions with reviewed candidate policy evidence. Both measures show their numerator, denominator, applicable question revisions, and limitations. Multiple accounts of one issue count as one covered question; repeated retellings of one source do not establish independent corroboration. Neither coverage measure establishes evidence confidence for a particular claim.

The initial proposed display gate is at least 5 applicable answered questions, 5 comparable questions, and 60% unweighted coverage for each candidate. These values are provisional and require review. Below the gate, show counts and evidence limitations without a headline agreement percentage. Comparisons retain ballot order and use no endorsement or evaluative ranking. Candidate denominators can differ; always disclose included questions, and a future common-question sensitivity view should identify that difference.

## Review and sensitivity

Before calculation, the future review page must show directional, neutral, skipped, and unanswered counts, unrated importance counts, more/most-important questions, and candidate-specific comparable counts. Users can edit either policy or importance independently. Recalculation uses the displayed method version.

Sensitivity views must compare the normal weighted result with equal weights and a separately labeled subset containing importance levels 4 and 5. A subset with inadequate coverage receives an insufficient-information state. An optional up-to-three-priorities mode is deferred; its multiplier or view definition needs its own version and explicit user choice.

## Versioning and configurable decisions

Keep the following in immutable method versions or versioned question/research configuration:

- All five importance weights and the null default.
- Policy range, distance formula, normalization, and display rounding.
- Minimum answer count, comparable count, and coverage gate.
- Office/jurisdiction applicability rules and judicial exclusion.
- Conflict and time-dependent evidence eligibility rules.
- High-priority subset definition, sensitivity gates, and any optional priority multiplier.
- Coverage definitions and headline presentation policy.

M1’s `proposedScoringMethod` stores the five weights, default, range, conflict rule, and display gates. The SQL method record stores formula text, default, thresholds, and linked importance options. Before implementation, add a machine-readable formula identifier and version any new sensitivity or rounding choices. M1 does not seed an approved scoring method into the database.

Future result exports must retain question revisions, answer states and values, importance ratings, candidate stance/evidence/review references, publication snapshot and checksum, scoring-method version, applicable/comparable question sets, denominators, and output precision. A later method revision must never alter an earlier saved result.

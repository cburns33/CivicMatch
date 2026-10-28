# CivicMatch TX handoff, October 27, 2026

The user authorized a selected-race launch to serve the closing election window and clarified that the audience is the user and friends. The homepage now implements a Texas governor guide with the full official race roster, source links, seven questions, answer/importance review, device-only storage, and sourced provisional comparisons. The user authorized processing all public candidate-policy material and research rows, then removed the mandatory human-approval gate for this small-group version. AI-assisted mappings are labeled provisional, with no fabricated human review. The synthetic explorer is at `/demo`. See [first-race release](first-race-release.md).

M2 remains in progress. County source/style blockers are deferred from the selected-race release and retain all existing publication guards. The [reviewer dashboard](https://civicmatch-tx.vercel.app/admin) retains source review, filtering, readiness, and mapping status, with a private research-preview entry point.

The provisional comparison release is live and verified on desktop and mobile at https://civicmatch-tx.vercel.app. Code commit `a01ea91` is READY as deployment `dpl_8ziuosXP2i4ZR2pjNDuyX1L8Jccu`. The complete live questionnaire, importance changes, expected scores, source inspection, local persistence/clearing, hosted private preview, anonymous denial, and sign-out clearing passed. No political answers were sent to the server; zero review decisions were created. Validation is 164 Vitest checks, 22 desktop/mobile browser flows, production build, and the live production journeys.

## Current state

- Official intake covers 58 PDFs plus one official candidate-portal workbook, with 317 PDF pages and 206 unverified OCR pages. The County Clerk write-in qualification-source gap is closed by the official SOS portal export.
- Current source-review batches have 391 Travis tasks and 286 Harris tasks, all open. Of those, 674 can be reviewed while three flags require new imports. Earlier batches remain immutable.
- Private normalized drafts preserve 445 voting contests, 681 printed/write-in entries, 131 measures, and eight declarations. Jurisdiction, district, office, election-type, seat, and vote-limit assignments remain incomplete. Travis has 430 assignment issues and Harris has 468; these counts are not confidence scores.
- Both drafts have automated source-archive verification receipts covering all 59 contributing sources. No human source/mapping approvals or style attestations were added. There are zero official composition publications and zero active pointers.
- The owner-only publisher and its guards are implemented. They require completed source reviews, an accepted complete mapping, exact archive checks, trusted official style evidence, review against the published baseline, and a matching expected active pointer. Reopened review evidence withdraws the pointer while retaining the immutable snapshot.
- The M1 fixture explorer and foundation entity tables are not connected to the normalized packets. Canonical identity across county research and address eligibility remain unfinished. The selected-race questionnaire/scorer is separate from those packets. Provisional research version `tx-governor-2026-10-27-v2-provisional` has 15 mapped positions across 15 primary pages, five of seven questions for each printed candidate, plus two explicit unscored ambiguities. Four write-ins have no mapped positions yet and remain visible. Pending working drafts v1/v2 are retained in the private database; the public provisional packet is versioned in Git.

## Outstanding source evidence

1. East Travis Gateway Library District needs an executed cancellation order or official correction. The county cancellation link still returns a general-election order form.
2. Both counties need independent official November individual-style references and authoritative style membership. Travis must preserve the separate ESD 10 existing-district and annexation electorates.
3. Official address-to-style fixtures remain absent. Current voter lookup forms were left unsubmitted, and no private voter records were accessed.

## Recommended next work

1. Collect the user's and friends' corrections to live provisional mappings. Preserve research versions and supporting source checksums. No per-position human approval is required for the authorized small-group release.
2. Fill governor evidence gaps, including write-ins, and extend to the next selected statewide race. Keep the same questions and research standards across candidates, with unknowns visible.
3. County mapping editor, trusted style evidence, and address validation remain deferred. Their separate publication controls remain in force.

## Verification and operating constraints

Last implementation checks passed: 141 Vitest tests, including 26 mapping/publisher cases; TypeScript/production build; 16 mocked desktop/mobile browser flows; and 44 live hosted Auth/API/publisher checks. Deployed desktop/mobile mapping-panel, review-filter, pagination, overflow, and sign-out checks passed with zero decision requests. Production publisher tests use rollback protection. Performance advisors are clear; the existing Free-plan leaked-password warning remains.

Use only confirmed Supabase project `rsmwpzzypdbpffdeolal`. Free only remains the spending limit. Do not enable paid features, reset the hosted database, or change applied migrations. Use new migrations for corrections.

Reviewer credentials stay in ignored `.env.local`. Do not print them or overwrite the file with an environment pull. Source archives, assignment files, normalized packets, and verification reports are ignored and need their own backup outside Git. No messages or records requests have been sent to county staff.

Detailed workflow: [mapping and publisher controls](m2-composition-publisher.md), [source review](m2-review-workflow.md), [Travis evidence gaps](travis-review-followup.md), [style validation](m2-ballot-style-validation.md), and [hosted verification history](m2-hosted-verification.md). `AGENTS.md` contains the current run/draft IDs and operational history.

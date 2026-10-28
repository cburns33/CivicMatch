# CivicMatch TX handoff, October 27, 2026

The user corrected the intended experience: one quiz organized by issue, followed by comparisons to all available politicians. The homepage now implements fourteen questions in five issue sections, with all fourteen governor and U.S. Senate candidates at the end. Each candidate uses only office-applicable answers. Earlier governor answers migrate into the unified device-only quiz without answering federal questions. The user authorized sourced provisional mappings for the user and friends, including all public research rows. No mandatory human approval is required for this version. The synthetic explorer is at `/demo`. See [issue quiz release](issue-quiz-release.md).

Senate research version `tx-senate-2026-10-27-v1-provisional` adds 18 numeric mappings and three explicit exclusions from 14 archived public source pages. Paxton has five mapped questions, Talarico six, Brown five, and write-in Hall two. All four write-ins retain official names and source links. The other three have no numeric mappings in this initial set. Combined governor/Senate coverage has 33 mapped positions. Unit/data/API checks: 169 passed. Browser flows: 24 passed. Production build passed. Core commit `23f2ff0` is deployed READY as `dpl_4deNxnpYUWFC9DxCoisnaYCe1yJW`; live desktop/mobile complete-quiz, all-candidate comparisons, importance, sources, persistence/clearing, and legacy migration passed with zero political-answer network writes or browser errors.

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

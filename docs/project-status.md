# CivicMatch TX handoff, October 27, 2026

The user authorized a selected-race launch to serve the closing election window. The homepage is being released as a Texas governor guide with the full official race roster, original-source links, a seven-question questionnaire, answer/importance review, device-only storage, and a comparison engine. Real candidate-position mappings require human review before public display. The synthetic explorer moves to `/demo`. See [first-race release and review boundary](first-race-release.md).

M2 remains in progress. County source/style blockers are deferred from the selected-race release and retain all existing publication guards. The [reviewer dashboard](https://civicmatch-tx.vercel.app/admin) retains source review, filtering, readiness, and mapping status, with a private research-preview entry point.

## Current state

- Official intake covers 58 PDFs plus one official candidate-portal workbook, with 317 PDF pages and 206 unverified OCR pages. The County Clerk write-in qualification-source gap is closed by the official SOS portal export.
- Current source-review batches have 391 Travis tasks and 286 Harris tasks, all open. Of those, 674 can be reviewed while three flags require new imports. Earlier batches remain immutable.
- Private normalized drafts preserve 445 voting contests, 681 printed/write-in entries, 131 measures, and eight declarations. Jurisdiction, district, office, election-type, seat, and vote-limit assignments remain incomplete. Travis has 430 assignment issues and Harris has 468; these counts are not confidence scores.
- Both drafts have automated source-archive verification receipts covering all 59 contributing sources. No human source/mapping approvals or style attestations were added. There are zero official composition publications and zero active pointers.
- The owner-only publisher and its guards are implemented. They require completed source reviews, an accepted complete mapping, exact archive checks, trusted official style evidence, review against the published baseline, and a matching expected active pointer. Reopened review evidence withdraws the pointer while retaining the immutable snapshot.
- The M1 fixture explorer and foundation entity tables are not connected to the normalized packets. Canonical candidate identity and address eligibility remain unfinished. The selected-race questionnaire/scorer is separate from the normalized county packets; candidate mappings remain unpublished pending human review.

## Outstanding source evidence

1. East Travis Gateway Library District needs an executed cancellation order or official correction. The county cancellation link still returns a general-election order form.
2. Both counties need independent official November individual-style references and authoritative style membership. Travis must preserve the separate ESD 10 existing-district and annexation electorates.
3. Official address-to-style fixtures remain absent. Current voter lookup forms were left unsubmitted, and no private voter records were accessed.

## Recommended next work

1. Complete the authorized public-policy research read and prepare the private governor evidence packet. The AGENTS.md confirmation for more than five research rows is pending. The original brief also requires human review before candidate-position publication.
2. Review the exact question mappings, exclusions, source dates, and coverage in the private preview. Release an attributed immutable approved research version only after that review. No draft positions belong in the public Git repository.
3. Expand reviewed race coverage, preserving every qualified candidate and evidence gaps. County mapping editor, trusted style evidence, and address validation remain deferred work.

## Verification and operating constraints

Last implementation checks passed: 141 Vitest tests, including 26 mapping/publisher cases; TypeScript/production build; 16 mocked desktop/mobile browser flows; and 44 live hosted Auth/API/publisher checks. Deployed desktop/mobile mapping-panel, review-filter, pagination, overflow, and sign-out checks passed with zero decision requests. Production publisher tests use rollback protection. Performance advisors are clear; the existing Free-plan leaked-password warning remains.

Use only confirmed Supabase project `rsmwpzzypdbpffdeolal`. Free only remains the spending limit. Do not enable paid features, reset the hosted database, or change applied migrations. Use new migrations for corrections.

Reviewer credentials stay in ignored `.env.local`. Do not print them or overwrite the file with an environment pull. Source archives, assignment files, normalized packets, and verification reports are ignored and need their own backup outside Git. No messages or records requests have been sent to county staff.

Detailed workflow: [mapping and publisher controls](m2-composition-publisher.md), [source review](m2-review-workflow.md), [Travis evidence gaps](travis-review-followup.md), [style validation](m2-ballot-style-validation.md), and [hosted verification history](m2-hosted-verification.md). `AGENTS.md` contains the current run/draft IDs and operational history.

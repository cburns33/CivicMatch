# CivicMatch TX handoff, October 26, 2026

M2 is in progress. The app and database changes are on `main` in [cburns33/CivicMatch](https://github.com/cburns33/CivicMatch). The live [reviewer dashboard](https://civicmatch-tx.vercel.app/admin) includes source review, filtering, readiness, and a read-only mapping-status panel. Public ballot content remains labeled synthetic data.

## Current state

- Official intake covers 58 PDFs plus one official candidate-portal workbook, with 317 PDF pages and 206 unverified OCR pages. The County Clerk write-in qualification-source gap is closed by the official SOS portal export.
- Current source-review batches have 391 Travis tasks and 286 Harris tasks, all open. Of those, 674 can be reviewed while three flags require new imports. Earlier batches remain immutable.
- Private normalized drafts preserve 445 voting contests, 681 printed/write-in entries, 131 measures, and eight declarations. Jurisdiction, district, office, election-type, seat, and vote-limit assignments remain incomplete. Travis has 430 assignment issues and Harris has 468; these counts are not confidence scores.
- Both drafts have automated source-archive verification receipts covering all 59 contributing sources. No human source/mapping approvals or style attestations were added. There are zero official composition publications and zero active pointers.
- The owner-only publisher and its guards are implemented. They require completed source reviews, an accepted complete mapping, exact archive checks, trusted official style evidence, review against the published baseline, and a matching expected active pointer. Reopened review evidence withdraws the pointer while retaining the immutable snapshot.
- The M1 fixture explorer and foundation entity tables are not connected to the normalized packets. Canonical candidate identity, positions, quiz/scoring, and address eligibility remain separate unfinished work.

## Outstanding source evidence

1. East Travis Gateway Library District needs an executed cancellation order or official correction. The county cancellation link still returns a general-election order form.
2. Both counties need independent official November individual-style references and authoritative style membership. Travis must preserve the separate ESD 10 existing-district and annexation electorates.
3. Official address-to-style fixtures remain absent. Current voter lookup forms were left unsubmitted, and no private voter records were accessed.

## Recommended next work

1. Build a reviewer-facing mapping editor and complete explicit assignments against the archived source pages. Preserve draft versions and require named review.
2. Add trusted import of independently compared and human-reviewed style evidence when the official files arrive. Produce a new evidence-backed source run to clear style hard blockers.
3. Finish source and mapping reviews, including comparison with any published baseline. Exercise a full county release only after every guard passes.
4. Add the normalized runtime consumer and official style/address fixtures before enabling any personalized ballot lookup. Complete the M2 acceptance checks before calling M2 finished.

## Verification and operating constraints

Last implementation checks passed: 141 Vitest tests, including 26 mapping/publisher cases; TypeScript/production build; 16 mocked desktop/mobile browser flows; and 44 live hosted Auth/API/publisher checks. Deployed desktop/mobile mapping-panel, review-filter, pagination, overflow, and sign-out checks passed with zero decision requests. Production publisher tests use rollback protection. Performance advisors are clear; the existing Free-plan leaked-password warning remains.

Use only confirmed Supabase project `rsmwpzzypdbpffdeolal`. Free only remains the spending limit. Do not enable paid features, reset the hosted database, or change applied migrations. Use new migrations for corrections.

Reviewer credentials stay in ignored `.env.local`. Do not print them or overwrite the file with an environment pull. Source archives, assignment files, normalized packets, and verification reports are ignored and need their own backup outside Git. No messages or records requests have been sent to county staff.

Detailed workflow: [mapping and publisher controls](m2-composition-publisher.md), [source review](m2-review-workflow.md), [Travis evidence gaps](travis-review-followup.md), [style validation](m2-ballot-style-validation.md), and [hosted verification history](m2-hosted-verification.md). `AGENTS.md` contains the current run/draft IDs and operational history.

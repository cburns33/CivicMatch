# M2 private import and review workflow

This step implements durable staging and evidence-linked review. It does not approve composition or publish a ballot snapshot. No hosted database has been selected or changed.

## What is implemented

- `stage_composition_batch` imports a county envelope and its sources, records, changes, supplemental matches, and issues in one PostgreSQL transaction. It checks record/source/page relationships and requires the review arrays. Repeated identical imports reuse the run; changed content under the same identity is rejected. An advisory transaction lock serializes retries.
- Immutable `composition_batches`, `composition_review_tasks`, and `composition_review_decisions` preserve the raw import and review history. Client roles have no direct write grants. RLS permits reads only for provisioned administrators.
- Each decision is attributed to the current `auth.uid()`. The function checks current membership in `private.admin_users`, a supporting source belonging to the import, a reason, and the allowed decision. User-editable token metadata never grants reviewer access.
- Open-task counts come from each task's latest append-only decision. A later rejection or evidence request reopens it. Counts have no client-editable override.
- Source gaps, extraction failures, and unverified style membership cannot be accepted through a note. They require a corrected or newly verified import. Historical source-gap tasks receive the same protection.
- `/admin` provides provisioned-account sign-in, paginated tasks, printed source content, before/after records, source links, decisions, latest decision history, and sign-out. Supabase sessions remain in browser memory. Every data read and decision is subject to database authorization. No service-role key is used by this flow.

The migrations are `20261026200436_composition_review_queue.sql`, `20261026201031_composition_review_page.sql`, and `20261026202032_composition_source_blockers.sql`. They add private working data to the foundation and do not change public snapshot permissions.

## Local staged store

```powershell
node scripts/import-review.mjs
```

The command verifies each source PDF against its content-addressed archive path and SHA-256, applies migrations to an ignored persistent PGlite store at `data/review-db/`, and stages the current county runs. It can be repeated without duplicating imports. It checks applied migration hashes and rejects edits to applied migrations.

The local store uses a minimal Auth shim and a synthetic local import actor. That actor imports records and produces no review decisions. It is not a human reviewer identity or a Supabase Auth/API test. Back up the local store alongside the source archive. The browser review UI uses the hosted Supabase Data API after configuration, and does not read the local PGlite directory.

## Hosted activation, pending project selection

1. Confirm the dedicated CivicMatch target and its cost before creating resources, or confirm an existing project's intended use. The discovered projects are generic and unrelated names; neither has been selected.
2. Apply the reviewed migrations to an isolated target. Run the full reset, database advisors, Auth/JWT/Data API checks, and role tests. PGlite verification alone does not replace these checks.
3. Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Provision a reviewer through trusted Auth administration, then insert that verified Auth UUID into `private.admin_users` through a trusted database connection. Client accounts cannot provision themselves.
4. Run the hosted import as the provisioned reviewer, with operator-only credentials supplied through environment variables. Never put reviewer credentials in `NEXT_PUBLIC_` variables, logs, or Git.

```powershell
node --env-file=.env.local scripts/import-review.mjs --hosted
```

The hosted command requires `CIVICMATCH_REVIEWER_EMAIL` and `CIVICMATCH_REVIEWER_PASSWORD`, signs in with the publishable client, calls the restricted import function, and signs out of that session. No source files, private keys, or user response tables are exposed to visitors. Imports remain pending review.

## Publication and eligibility boundary

No function in this step marks a composition import approved, writes a public snapshot, or updates an active-snapshot pointer. Reviewer decisions are necessary inputs to the future trusted publisher. Full source membership validation, an approved baseline for production diffs, complete normalized relationships, official style comparisons, and immutable snapshot validation remain required.

There are zero verified official address/style fixtures. A consolidated county master remains a contest universe. Public civic addresses and official lookup references can be considered after the required source approval and access checks; private voter identifiers are excluded. Personalized lookup stays disabled.

## Verification limits

PostgreSQL tests exercise transaction rollback, idempotence, altered-payload rejection, role/RLS isolation, current membership, history immutability, decision reopening, source membership, and hard blockers. Browser tests use a synthetic mocked Auth/Data API and check sign-in, evidence-linked saving, latest-decision display, disabled blocker acceptance, sign-out, and denial of non-reviewer access on desktop/mobile. Real hosted Auth/JWT/Data API checks remain pending target configuration.

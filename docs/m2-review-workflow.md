# M2 private import and review workflow

This step implements durable staging and evidence-linked review. It does not approve composition or publish a ballot snapshot. The user-selected project `rsmwpzzypdbpffdeolal` now hosts both current county imports. See [hosted verification](m2-hosted-verification.md).

## What is implemented

- `stage_composition_batch` imports a county envelope and its sources, records, changes, supplemental matches, and issues in one PostgreSQL transaction. It checks record/source/page relationships and requires the review arrays. Repeated identical imports reuse the run; changed content under the same identity is rejected. An advisory transaction lock serializes retries.
- Immutable `composition_batches`, `composition_review_tasks`, and `composition_review_decisions` preserve the raw import and review history. Client roles have no direct write grants. RLS permits reads only for provisioned administrators.
- Each decision is attributed to the current `auth.uid()`. The function checks current membership in `private.admin_users`, a supporting source belonging to the import, a reason, and the allowed decision. User-editable token metadata never grants reviewer access.
- Open-task counts come from each task's latest append-only decision. A later rejection or evidence request reopens it. Counts have no client-editable override.
- Source gaps, extraction failures, and unverified style membership cannot be accepted through a note. They require a corrected or newly verified import. Historical source-gap tasks receive the same protection.
- `/admin` provides provisioned-account sign-in, paginated tasks, printed source content, before/after records, source links, decisions, latest decision history, and sign-out. Supabase sessions remain in browser memory. Every data read and decision is subject to database authorization. No service-role key is used by this flow.

The workbook-evidence extension is `20261027013703_official_workbook_reference.sql`; it permits official portal XLSX supporting references while preserving reviewer checks and PDF masters. The review migrations are `20261026200436_composition_review_queue.sql`, `20261026201031_composition_review_page.sql`, `20261026202032_composition_source_blockers.sql`, and `20261027005856_private_review_functions.sql`. Privileged write implementations live in the private schema, behind public invoker wrappers with current-membership checks. The membership lookup uses the caller's read-own-membership policy. Public snapshot permissions are unchanged.

## Local staged store

```powershell
node scripts/import-review.mjs
```

The command verifies each source PDF against its content-addressed archive path and SHA-256, applies migrations to an ignored persistent PGlite store at `data/review-db/`, and stages the current county runs. It can be repeated without duplicating imports. It checks applied migration hashes and rejects edits to applied migrations.

The local store uses a minimal Auth shim and a synthetic local import actor. That actor imports records and produces no review decisions. It is not a human reviewer identity or a Supabase Auth/API test. Back up the local store alongside the source archive. The browser review UI uses the hosted Supabase Data API after configuration, and does not read the local PGlite directory.

## Hosted configuration

1. Use the confirmed project `rsmwpzzypdbpffdeolal` in the dedicated `CivicMatch TX` organization. The user's Free-only constraint remains in force. Existing unrelated projects are unchanged.
2. All five migrations were applied to the new project's empty application schema. Hosted Auth/JWT/Data API checks and database advisors were run. Docker-backed local reset is still unavailable; no hosted reset was performed.
3. Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. A reviewer matching the authenticated Supabase owner's email has been provisioned through Auth administration and `private.admin_users`. Its generated password is stored only in ignored `.env.local`. No email was sent. Client accounts cannot provision themselves. Public signup is disabled.
4. Run the hosted import as the provisioned reviewer, with operator-only credentials supplied through environment variables. Never put reviewer credentials in `NEXT_PUBLIC_` variables, logs, or Git.

```powershell
node --env-file=.env.local scripts/import-review.mjs --hosted
```

The hosted command requires `CIVICMATCH_REVIEWER_EMAIL` and `CIVICMATCH_REVIEWER_PASSWORD`, signs in with the publishable client, calls the restricted import function, and signs out of that session. No source files, private keys, or user response tables are exposed to visitors. Imports remain pending review.

## Publication and eligibility boundary

No function in this step marks a composition import approved, writes a public snapshot, or updates an active-snapshot pointer. Reviewer decisions are necessary inputs to the future trusted publisher. Full source membership validation, an approved baseline for production diffs, complete normalized relationships, official style comparisons, and immutable snapshot validation remain required.

There are zero verified official address/style fixtures. A consolidated county master remains a contest universe. Public civic addresses and official lookup references can be considered after the required source approval and access checks; private voter identifiers are excluded. Personalized lookup stays disabled.

## Verification limits

PostgreSQL tests exercise transaction rollback, idempotence, altered-payload rejection, role/RLS isolation, current membership, history immutability, decision reopening, source membership, and hard blockers. Mocked browser tests cover sign-in, saving, decision history, sign-out, and non-reviewer denial. The separate live hosted verification checks real passwords/JWTs, API grants, RLS, source blockers, token forgery, and membership revocation. It creates and removes one synthetic non-reviewer and never accepts a ballot review task.

Current v4 imports contain 391 Travis tasks, including two hard blockers, and 286 Harris tasks, including one hard blocker. Earlier batches are retained. Both current batches have zero decisions. Style comparison reports remain separate from approval and cannot clear a review blocker.

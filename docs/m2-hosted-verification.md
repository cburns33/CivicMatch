# M2 hosted review activation, October 26, 2026

The user created the dedicated Supabase project and supplied its URL and publishable key through ignored `.env.local`. Only this project was linked and changed. The Free-only restriction remains in effect, with no paid branches, compute upgrades, or add-ons enabled.

| Item | Result |
| --- | --- |
| Project | `rsmwpzzypdbpffdeolal`, CivicMatch, US East 1 |
| Organization | `otukajvqqkenmrnmqxtj`, CivicMatch TX |
| Application schema | Five migrations applied, 35 application tables, all with RLS |
| Private intake | Two current imports, 679 tasks: 393 Travis and 286 Harris |
| Review/publication | Zero decisions and zero publication snapshots |

## Configuration and accounts

The local file's supplied values were mapped to `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Vercel production receives only those two public configuration values. Reviewer credentials and server-only keys are absent from Vercel and Git.

A reviewer was created for the authenticated Supabase owner account's email, with a generated password in local `.env.local` under `CIVICMATCH_REVIEWER_PASSWORD`. No email was sent, and no pre-existing user's password was changed. The account's UUID was provisioned in `private.admin_users` through a trusted database connection. The supplied publishable key does not grant reviewer access by itself.

Public signup is disabled. The Auth site URL is the existing Vercel site, with the intended production and localhost reviewer redirects. Undeclared provider settings, including its MFA settings, were preserved.

Privileged review writes were moved into the unexposed private schema. Public functions are invoker wrappers. Both privileged implementations check current administrator membership, and callers cannot insert review rows or snapshots through direct table requests. The membership lookup runs under the caller's read-own-membership policy.

## Live verification

Run from a trusted operator workstation:

```powershell
node --env-file=.env.local scripts/verify-hosted-review.mjs
```

The script is pinned to the confirmed project. It obtains the server-only key through the authenticated Supabase CLI, keeps it in process memory, and does not print or persist it. It creates one synthetic non-reviewer with admin-looking user metadata, then revokes its session and removes the account. It does not create review decisions, approve imports, or alter ballot records.

Twenty-two live checks pass across these behaviors:

- The owner reviewer signs in with real Supabase Auth and can read both imports through the Data API.
- Anonymous users cannot read drafts or invoke reviewer RPCs. The public snapshot collection is empty.
- An ordinary signed-in user sees no draft tasks, cannot import records, and gains no authorization from editable metadata.
- Reviewers cannot write draft tables or publication snapshots directly, and the private schema is absent from the Data API.
- A forged JWT is rejected by the gateway. A legitimate JWT observes a membership grant and revocation without being replaced.
- An attempted acceptance of a hard blocker is rejected. The test leaves zero decisions, and its synthetic account is removed.

Repeated hosted imports reuse the same run identities and leave two batches and 679 tasks. These checks exercise actual hosted Auth, JWT verification, grants, RLS, and RPC behavior. They extend the PGlite suite and mocked browser tests.

## Deployed reviewer screen

Code commit `b1a28d0dd2179ea29e69c50a450542c1ee788f2b` triggered Vercel production deployment `dpl_84yUfnEAj9BUzzjUx4aVmerF22k6`, READY at [the reviewer screen](https://civicmatch-tx.vercel.app/admin). Real desktop and mobile checks verified HTTP 200, reviewer sign-in, both county task counts, county switching, no horizontal overflow, and removal of draft content on sign-out. No decisions were saved. Verification images and reports are in ignored `output/hosted-setup/`.

## Advisors and remaining limits

The three exposed privileged-function warnings were resolved. The performance advisor reports no warnings or errors. The security advisor retains one provider warning: leaked-password protection is disabled. Supabase documents that feature as [Pro and above](https://supabase.com/docs/guides/auth/password-security); it was left off to honor the Free-only restriction. The provisioned reviewer uses a generated password, public signup is disabled, and existing provider MFA settings were preserved.

Original source review remains incomplete. County Clerk write-in certification, the library cancellation conflict, official ballot-style/address references, normalized composition mapping, and the trusted publisher remain outstanding. Hosted connectivity is not evidence of approved ballot composition. No official personalized ballot or candidate ranking is published.

## M2 v4 continuation

Migration `20261027013703_official_workbook_reference.sql` is applied to the confirmed project. It extends private staging to accept the official SOS portal XLSX supporting reference, preserving PDF county masters and existing access checks. Current imports contain 391 Travis tasks and 286 Harris tasks, all open; prior batches remain immutable. `verify-hosted-review.mjs` now selects the current run IDs from local intake pointers before its bounded API checks. All 22 live checks passed after migration and import. Repeat imports are idempotent.

Code commit `0e3cddce9386bd4c8fcc39a3001d1024952d4bd0` is deployed READY as `dpl_FXZkCUDNuQfz39kQFwoqzACXZkBP`. The deployed reviewer UI passed owner sign-in, both current imports, zero accepted tasks, desktop/mobile overflow, and clearing drafts on sign-out. The public intake page shows 12 Travis named write-in matches, the portal workbook reference, and blocked style coverage for both counties without exposing draft candidate names. No decisions were saved by verification. Performance advisors remain clear; the prior Free-plan leaked-password warning remains. No paid feature was enabled.

Local verification for this continuation: 105 Vitest, 26 Python, 12 mocked desktop/mobile browser tests, and the production build passed. Independent official ballot-style references and human review remain missing. See [style validation](m2-ballot-style-validation.md).

## Review readiness and filtering continuation

Migration `20261027020555_review_readiness_and_filters.sql` adds read-only reviewer search and readiness RPCs using current membership and existing RLS. The current unchanged imports report 389 Travis and 285 Harris open tasks available for review, with two and one flags requiring new imports. No review decisions were created. A new operator command, `scripts/check-review-readiness.mjs`, saves a bounded aggregate report and returns exit 2 while publication is unavailable.

Expanded hosted verification passes 32 checks, including exact readiness totals and filtered counts, anonymous denial, ordinary-user isolation, and readiness after membership revocation with the same JWT. Performance advisors remain clear. The prior Free-plan leaked-password warning is unchanged. No paid capability was enabled.

Code commit `68f8e4e0efa607bbd48e52da43ed17a90f5385c1` deployed READY at `https://civicmatch-3d1980a79-cburns33s-projects.vercel.app`, assigned to the stable CivicMatch site. Actual deployed desktop and mobile browser checks passed current counts, filtered pagination, blocked-task acceptance disabled, search, empty-state recovery, clearing filters, county switching, responsive width, and sign-out cleanup. The test sent zero decision requests. Local verification passed 115 Vitest tests, 16 mocked browser flows, and the production build. Official composition publication, source/style/address validation, and the trusted publisher remain separate unfinished M2 requirements.

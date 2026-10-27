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

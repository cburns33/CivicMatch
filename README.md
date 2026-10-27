# CivicMatch TX

Start with the [current project status and next steps](docs/project-status.md) when resuming work. M2 is in progress; official composition publication remains blocked on assignments, human review, and official style evidence.

Mobile-first, nonpartisan voter information for the November 3, 2026 election. The homepage now provides a selected Texas governor race guide with all three printed candidates and four qualified write-ins, original-source links, and a seven-question device-only questionnaire. Candidate-position mappings and public agreement scores await human review. The synthetic ballot explorer remains at `/demo`. No individual ballot or eligibility claim is made. See [first-race release](docs/first-race-release.md).

M2 source intake is in progress. The [official source status page](https://civicmatch-tx.vercel.app/official-data) tracks 58 archived PDFs plus one official candidate-portal workbook, all pending review. The county adapters stage 314 candidate contests, 655 printed entries, 131 proposition records, and eight unopposed declaration blocks across both masters. They reconcile 26 county-contest write-in entries and 82 cancellation scopes. All 317 source pages are archived, with targeted first-page extraction for the two added reference orders and 206 pages of unverified machine transcription. Structured records remain private and unreviewed; the ballot explorer still uses test fixtures. See [M2 intake scope and next steps](docs/m2-intake.md) and [ballot style validation](docs/m2-ballot-style-validation.md).

M2 includes a hosted private review queue with transactional imports, source-linked decisions, immutable history, current administrator membership checks, and open-task counts derived from decisions. The confirmed CivicMatch Supabase project holds 677 pending tasks in the current county imports and zero review decisions; earlier imports remain preserved. The reviewer dashboard supports task filters, search, and a per-import readiness checklist, with 674 tasks available for review while three source/style flags await new imports. The local review store remains available with its explicit Auth shim. See [review workflow and setup](docs/m2-review-workflow.md), [hosted verification](docs/m2-hosted-verification.md), and [Travis flag findings](docs/travis-review-followup.md).

## Run locally

Use Node.js 22.12+ or 24 LTS and npm. The pinned lockfile is the dependency source of truth.

```powershell
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). The guide and questionnaire need no database configuration. The private `/admin` screen uses the project URL and publishable key named in `.env.example`. Never put reviewer passwords or server-only keys in `NEXT_PUBLIC_` variables.

```powershell
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Vitest runs domain validation and an embedded PostgreSQL migration/constraint/RLS suite through PGlite. Playwright covers desktop and mobile Chromium. PGlite supplies a minimal `auth` shim for tests; it does not verify the Supabase API, JWT gateway, Auth service, or hosted configuration.

## Local Supabase, optional

Docker is required for the full local stack. No hosted project is linked or modified by M1.

```powershell
npx supabase start
npx supabase db reset
```

`db reset` recreates the **local** database. The foundation migration creates the normalized schema, constraints, indexes, RLS policies, review references, and snapshot guards. The seed file inserts no data. A real Supabase stack smoke test and advisors remain required before a hosted migration or admin launch.

Supabase administrators are provisioned by a trusted database operator in `private.admin_users`, using an existing `auth.users.id`. Signed-in users cannot provision themselves. No admin UI or sign-in flow is implemented in M1. No user responses are collected or synced.

## What is included

- Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui-style Button and component configuration.
- Searchable, filterable ballot overview with Austin and Houston test styles, all ten office categories, exact test proposition wording, a qualified write-in, an uncontested race, and separate judicial guidance.
- Zod schemas and inferred TypeScript types for ballots, provenance, evidence, reviews, question revisions, response states, importance, and scoring configuration.
- Supabase PostgreSQL migration with normalized models and immutable publication payloads.
- Proposed methodology and official-resource navigation pages.
- Python official-document archive, county layout adapters, supplemental reconciliation, source diffs, and a local review packet.

## Project map

| Path | Purpose |
| --- | --- |
| `src/app/` | Overview, proposed methodology, official-resource navigation, shared shell |
| `src/components/` | Interactive fixture explorer and UI primitive |
| `src/domain/` | Runtime schemas, relationships, and TypeScript types |
| `src/data/fixtures.ts` | Synthetic test dataset with explicit fixture provenance |
| `supabase/migrations/` | Database foundation |
| `tests/` | Vitest domain/database tests and Playwright flows |
| `pipelines/` | Official document intake and unapproved staging |
| `docs/` | Architecture, scoring proposal, ingestion plan, acceptance record |

## Boundaries

M1 does not import election data, geocode addresses, determine eligibility, run a quiz, calculate matches, publish candidate positions, or authenticate admins. City selection chooses a fixture dataset and never assumes a county. Official source links do not substantiate fixture records.

Read [architecture](docs/architecture.md), [proposed scoring](docs/scoring-methodology.md), [M2 ingestion plan](docs/ingestion-plan.md), and [M1 acceptance](docs/m1-acceptance.md) before extending the platform.

The [evidence review standard](docs/evidence-methodology.md) documents separate action, statement, insider-interpretation, and motive claims, with claim-specific evidence-confidence labels and separate reviewer certainty. The published methodology and preliminary review schema reflect this standard. Live research intake and scoring remain deferred.

## Hosted fixture preview

At the user's request, the preview is hosted at [civicmatch-tx.vercel.app](https://civicmatch-tx.vercel.app). Vercel project: `cburns33s-projects/civicmatch-tx`, connected to `cburns33/CivicMatch`. The private review workflow connects to the dedicated Supabase project `rsmwpzzypdbpffdeolal`; public pages continue to use fixtures and source-intake metadata. Deployment configuration is in `vercel.json`; `.vercelignore` excludes local state, environment files, tests, and non-web workspaces from uploads. Official composition remains unapproved.

M2 now includes private normalized mapping drafts and owner-only publisher controls, with published-baseline diffs, source/style gates, immutable composition snapshots, active-pointer checks, and withdrawal when review evidence is reopened. The current drafts preserve all 445 voting contests, 681 printed/write-in entries, 131 measures, and eight declarations. Explicit assignments and human reviews remain incomplete. See [the mapping and publisher workflow](docs/m2-composition-publisher.md). No official composition has been published or connected to the explorer.

# M1 acceptance record

Date: October 26, 2026. Workspace: `D:\Documents\ISideWithTexas`.

## Acceptance criteria

| M1 requirement | Delivered |
| --- | --- |
| Project structure and development setup | Next.js App Router, TypeScript, Tailwind CSS, UI component configuration, pinned npm lockfile, Vitest, Playwright, Supabase CLI/config, reserved Python workspace |
| Database schema and migrations | Normalized composition, geography, question/response, evidence/review, provenance/import, immutable snapshot, correction, and optional-sync tables |
| TypeScript interfaces and validation | Zod runtime schemas with inferred TypeScript types and cross-record dataset integrity checks |
| Basic full-ballot overview | Two labeled synthetic styles, all ten office categories, search/filter controls, expanded candidate/measure details, judicial guidance, write-in and uncontested examples |
| Provenance and versioning | Source checksums/retrieval metadata, ingestion runs/diffs, provenance references, immutable revisions/reviews and publication artifacts |
| Integrity unit tests | Duplicate IDs and memberships, orphan relationships, cross-election links, exact fixture text, wrong contest kinds, response states, and database access rules |
| Local development documentation | README with setup, checks, optional Supabase instructions, scope, and security limits |
| Official ingestion technical plan | Source-specific observations and linked official references, adapter contract, idempotence/review/publishing plan, official address fixture matrix |
| Preliminary quiz schemas | Policy response values and null states, independent optional importance, question revisions, scoring-method versions, and reserved opt-in sessions |
| Proposed scoring documentation | Formula, weights, coverage, provisional minimum-data gates, sensitivity requirements, reproducibility, and configurable decisions |

## Verification

- `npm test`: **61 passed**, covering domain validation and an embedded PostgreSQL migration/constraints/RLS suite.
- `npm run typecheck`: passed.
- `npm run test:e2e`: **6 passed**, three flows each on desktop and mobile Chromium. Tests cover explicit fixture labeling, all style contests, city switching, qualified write-in detail, proposition wording, search/reset, judicial guidance, methodology, source navigation, and mobile overflow.
- `npm run build`: passed, with static overview, methodology, and source pages.
- Manual Playwright visual inspection at desktop and mobile sizes: checked layout and increased reading/control text sizes. Screenshots are under ignored `output/playwright/`.

The initial database test caught a generated-column checksum expression that PostgreSQL classifies as non-immutable. The final migration computes the checksum in its snapshot-insert trigger and rejects all later snapshot mutations. A missing browser icon was added during visual checks.

## Security and model checks

All application tables have RLS. Tests exercise administrator membership, denied self-provisioning, anonymous draft denial, non-admin draft visibility and mutation denial, owner-only sessions, ownership-reassignment denial, immutable question versions and snapshots, client publication denial, fixture-source publication denial, unresolved import-change rejection, and approved-review foreign keys. Anonymous clients can read immutable publication payloads only. No privileged keys exist in browser code.

The migration does not establish a full publisher. A trusted M2 publication transaction must validate the payload and all contributing runs, research evidence sets, and official reference comparisons. Source and method history stays immutable; corrections require new artifacts.

## Remaining risks and deferred work

- No full Supabase stack was run because Docker and psql are unavailable. PGlite’s Auth shim verifies PostgreSQL policy behavior only. Supabase Auth/JWT, API grants through PostgREST, advisors, and a clean stack reset remain required before deployment.
- No source adapter, archive service, import reviewer UI, live candidate position, address lookup, official address-to-ballot fixture, or geographic eligibility logic exists. Current fixture assignments and names cannot verify a real ballot.
- Source discovery is a dated research snapshot. County links, signed URLs, document layouts, permissions, and Google coverage require validation when M2 begins. Some neighboring-county election document sets remain unverified, as recorded in the ingestion plan.
- GeoJSON storage validates only the envelope and effective date range. Geometry topology, boundary queries, and official style confirmation are deferred.
- The scoring configuration and minimum-data gates are proposals. Scoring, review UX, sensitivity views, local response storage, optional sync, and result exports remain future work.
- Administration authentication and protected routes are deferred. M1 defines database access rules without a sign-in surface.
- The first M1 delivery was local. The user then authorized Vercel deployment on October 26, 2026 to view it away from the PC. The fixture preview is live at [civicmatch-tx.vercel.app](https://civicmatch-tx.vercel.app), deployment `dpl_D54kZj2VZ2fwpSHCxHHBhCcvqpHo`, with Vercel READY status and HTTP 200/title verification. No Git remote or Supabase database was created or connected.

M1 stops here. The next authorized implementation should begin from the source discovery and review gates in the M2 ingestion plan.

## Authorized methodology update, October 26, 2026

The user authorized incorporating the reviewer-calibration lessons into the app methodology. The updated page publishes `evidence-review-v1`, separating documented actions, recorded statements, insider interpretations, and inferred motives. It explains research versus comparison coverage, claim-specific evidence confidence, source perspective and knowledge basis, separate reviewer certainty, source independence, and the exclusion of insider interpretations/motives from policy matching and policy-evidence coverage.

The preliminary `claimAssessmentSchema` requires source references for assessed confidence, attribution for insider interpretations, and alternatives/limits for motive inferences. Strong and qualified labels require verified primary or firsthand support and resolved material conflicts. Strong support also requires direct relevance. Repeated secondhand accounts alone cannot receive those labels. These are structural checks; reviewers still determine source meaning and whether an inference is justified.

Verification after the update: **74 Vitest tests passed**, TypeScript passed, **6 desktop/mobile Playwright flows passed**, and the production build passed. The browser suite checks the new methodology categories, support labels, separate reviewer certainty, and mobile overflow. No database migration, research intake, scorer, or real candidate assessment was added. The existing Supabase verification limits still apply.

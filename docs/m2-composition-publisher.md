# M2 normalized mapping and publisher controls

The mapping and publication transaction can be developed while official references are pending. Both current county imports now have private, incomplete mapping drafts. No source review, mapping approval, human style attestation, public composition, or active pointer was created for them.

## Normalized drafts

`composition_mapping_template` creates an explicit assignment worksheet for an immutable source run. Jurisdiction, district, office type, election type, seats, and vote limit require review. The template leaves unknown assignments empty. It does not infer district eligibility or create a personalized ballot from the county master.

The database builds the normalized packet from its stored source records. A caller cannot replace candidate names or proposition text through the mapping input. The packet separates jurisdictions, districts, styles, contests, candidates, entries, measures, declarations, memberships, cancellations, and source metadata. Text, language variants, response options, vote instructions, blank write-in slots, electorate scopes, and source page/column/bounds/spans remain traceable. Declared-elected text stays outside voting contests. Cancellation notices never delete records.

Candidate IDs identify source occurrences. Equal names do not merge people across entries, contests, or counties. Canonical person identity for candidate research remains separate. Qualified write-ins retain their certification source and worksheet/row references when applicable. Their printed ballot order is null; certification order is a separate field.

Draft IDs hash the complete mapping artifact using SHA-256 over PostgreSQL JSONB text. The input mapping and normalization issues remain private. Public composition payloads use selected normalized fields. Repeating the same mapping and source run reuses the same draft. Editing assignments produces another immutable draft and requires another review.

This M2 composition packet retains fields that the M1 fixture explorer does not model. It is not wired into that explorer and does not populate the M1 foundation entity tables. Those remain separate working models. M2 composition publications use their own immutable table and active pointer, separate from the M1 generic research snapshot table. Public ballot content remains synthetic.

## Operator preparation

```powershell
node scripts/prepare-composition.mjs
node --env-file=.env.local scripts/prepare-composition.mjs --hosted
```

The first command applies local migrations and imports through the explicit local Auth shim. The hosted command pins the confirmed project and uses the provisioned reviewer with the publishable client. Both save templates to ignored `data/official/mappings/<county>-<run>.json`, immutable packets to `data/official/normalized/<draft>.json`, and aggregate reports to `output/composition/`. Existing assignment files are preserved. A file tied to an older run cannot be reused without updating and reviewing its assignments.

Current drafts:

| County | Draft SHA-256 | Voting contests | Printed/write-in entries | Measures | Declarations | Mapping issues |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Travis | `1ca31e73d2064feceb7f2f7d9e2f3308b56c4ee6d6b3d7d36b94cd8873412a6d` | 214 | 273 | 93 | 2 | 430 |
| Harris | `1b484a730e4238a8971a84b5a851d65144ecc70c0721da745ad4ed3110a93b37` | 231 | 408 | 38 | 6 | 468 |

The issues are missing assignments, with multiple fields possible per record. They are not confidence scores. The 445 voting contests include 314 candidate contests and 131 measures; eight declaration blocks are preserved separately. No jurisdiction or office assignment has been approved by this preparation step.

## Archive and style evidence

`node scripts/verify-composition-archives.mjs <draft-sha>` checks the draft file against the database's JSONB checksum convention, then checks every contributing archive's content-addressed path, size, and SHA-256. Its receipt states that no human review or publication occurred.

`node --env-file=.env.local scripts/record-composition-archives.mjs <draft-sha>` reruns those checks, authenticates the operator, and records their exact source manifest through the owner's linked database CLI. The database rechecks current membership and the draft manifest. This step requires the trusted CLI connection; browser accounts cannot write an archive attestation. The current two receipts cover 56 Travis and three Harris contributing sources. These are automated byte checks, not human review decisions.

Human style attestations remain absent. The unexposed `private.composition_style_attestations` table is reserved for a trusted operator after independent official style comparison and named human review. Each attestation binds the exact draft, style code, language, reference bytes, comparison receipt checksum, ordered source record IDs, and reviewer. The operator must check actual archived reference bytes and the reviewed comparison, including the mapped office/seat/vote-limit assignments. A caller-supplied passed flag or copied county master is insufficient. The comparison harness in `pipelines/validate_styles.py` remains the reference for byte/page/content checks. No automatic step in this workflow creates a human style attestation.

## Mapping review and approved baselines

`composition_mapping_diff` compares a draft with the last published composition for the county and election. It includes records, candidate choices/order, bilingual measures, declarations, jurisdiction/district metadata, style membership/order, and cancellation records. Source-occurrence IDs and provenance changes are excluded from entry-level semantic comparison; their independent source checks still apply. Before/after values preserve additions, changes, and removals for review.

Mapping reviews are append-only and attributed to the current authenticated reviewer. Incomplete mappings cannot be accepted. An accepted review must identify the published baseline it compared. `review_composition_mapping_against` checks that expected baseline under the same county/election lock as publication. The three-argument review method can accept only when no published baseline exists. A later publication makes an older baseline review stale. Reviewing another draft does not transfer approval to it.

## Publication transaction

`private.publish_composition(draft_sha, expected_active_snapshot)` is an unexposed, owner-only database function. It has no browser RPC, HTTP route, or service-key grant. The trusted database transaction must identify a current provisioned reviewer. No new server key or database credential is stored in Vercel.

Publication requires:

- The newest successful source import for the county and election.
- Every source task accepted, with zero hard blockers.
- A complete mapping, rebuilt from the immutable source run, and an accepted mapping review tied to the current published baseline.
- A registered exact-manifest archive check and trusted official style evidence bound to every draft/style/language/membership.
- Complete style coverage for voting contests.
- Valid source membership for candidate-entry provenance.
- The caller's expected active snapshot still matching the current pointer.

Imports, source decisions, mapping decisions, attestations, and publication share a county/election transaction lock. The publisher creates the immutable snapshot, database checksum, version, active pointer, and audit event in one transaction. Retrying an already active draft reuses the snapshot. A stale pointer or changed baseline fails before activation. Client roles have no direct publication, pointer, or attestation writes. Service-role permissions were checked and cannot insert publications or execute the publisher.

Reopening an accepted source or mapping review withdraws the active pointer and records an audit event. The previous snapshot remains immutable. New pending source imports retain the last approved snapshot until replacement. Publication of a composition style does not verify a person's address; every packet carries `addressEligibilityVerified: false`. Address matching remains disabled pending its own official fixture suite.

## Verification and remaining work

Synthetic local tests exercise successful publication, idempotence, replacement, semantic baseline changes, stale-pointer rejection, automatic withdrawal, immutability, permissions, name separation, write-in order, exact wording, declarations, invalid assignments, missing evidence, and provenance. The production guard checks are negative tests against the pending drafts, wrapped so unexpected success rolls back. No official publication is used as a test fixture.

The current drafts remain blocked on explicit assignments, mapping approval, complete official style membership/evidence, and all source reviews, including the remaining library cancellation issue. Archive checks are the only attestations recorded. A reviewer-facing mapping editor, trusted style-attestation import, runtime composition consumer, official style/address fixtures, and full M2 acceptance remain outstanding. The current county adapter still emits a style hard blocker; verified reference ingestion must produce a new evidence-backed run before publication can proceed.

A follow-up migration, `20261027031641_composition_mapping_type_checks.sql`, rejects non-string entity names/keys and malformed style-member types. It preserves the current valid packet hashes. The preparation script and archive receipts remain unchanged.

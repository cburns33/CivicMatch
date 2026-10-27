# M2 county source intake, October 26, 2026

The county-wide normalization and supplemental reconciliation pass is staged for review. M2 remains in progress. Official composition, ballot-style membership, and individual eligibility remain unverified.

## Source inventory and current scope

Sources come from [Travis County's current election page](https://votetravis.gov/current-election-information/current-election/), its [November required-notices index](https://votetravis.gov/resources/required-notices/), [Harris County's ballot page](https://www.harrisvotes.com/Voter/Whats-on-my-Ballot), and the [Texas SOS November election index](https://www.sos.texas.gov/elections/laws/2026-november-general-election.shtml). The user approved all relevant county document rows and files over 1 MB, then approved all rows of the state write-in certification. Voter-registration and private voter records are excluded.

| County | PDFs | Pages | Candidate contests | Printed candidate entries | Proposition records | Declaration blocks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Travis | 55 | 299 | 121 | 261 | 93 | 2 |
| Harris | 3 | 18 | 193 | 394 | 38 | 6 |
| Total | 58 | 317 | 314 | 655 | 131 | 8 |

Travis's inventory consists of its 18-page master, 51 cancellation PDFs totaling 272 pages, the one-page statewide/district write-in certification, and two scope-reference orders totaling eight pages. The added orders are below 1 MB and use targeted page-1 extraction. Harris's inventory consists of its 14-page master, one-page write-in list, and three-page cancellation list. A further official portal workbook contains one worksheet and two candidate rows. It supplies named County Clerk write-in qualification evidence; contact fields are excluded from staging. This makes 59 contributing sources: 58 PDFs and one XLSX. HTML discovery pages and retrieval receipts are archived too. Every Travis November cancellation index link must appear in the manifest before the command can stage a run.

The `county-reference-v4` adapter accounts for all 452 Travis and 476 Harris printed choice symbols across all 128 master-page columns. Source-region coverage is an extraction check. It cannot establish a complete personalized ballot. Records preserve printed labels, party labels, order, multi-seat voting instructions, English/Spanish proposition wording, response options, raw regions, page/column/bounds, and document checksums. Declaration blocks remain distinct from voting contests. No global candidate identities are merged.

The initial `federal-reference-v1` pass staged 15 federal contests and 34 printed entries. Those candidate arrays match the expanded adapter's federal records. Its immutable artifacts remain available for comparison.

## Write-in reconciliation

The state certification supplies 17 rows. Eleven match Travis offices with printed write-in slots; six refer to offices outside the Travis master scope. Harris's county list supplies 14 rows, all matched to unique offices with printed slots. The official SOS Candidate Bio Portal export adds Travis County Clerk, for 26 county-contest entries, with statewide names appearing in both counties. Certified names retain their own source office, name, page, bounds, and checksum. They remain separate from printed candidates and from generic write-in slots.

Travis's County Clerk qualification-source gap is closed by the current SOS-linked Candidate Bio Portal export. It lists LASHAWN NASH as WRITE-IN with status Candidate in the General Election for that office and election. The staged slot now has a separate named write-in with worksheet/row/checksum provenance. Human review remains pending. The statewide/district PDF alone still cannot establish a local identity. See [Travis follow-up](travis-review-followup.md).

## Cancellation reconciliation

| Result | Travis scopes | Harris scopes |
| --- | ---: | ---: |
| Supports an unopposed declaration block | 2 | 6 |
| No matching master record | 48 | 25 |
| Requires source clarification | 1 | 0 |
| Possible active candidate conflict | 0 | 0 |

All 82 scopes retain their source and match results. A missing master record is recorded as an absence of a match, with no claim that the notice was applied to a verified style. Cancellation reconciliation never deletes a record. A notice concerning an office does not remove propositions in the same jurisdiction. Office/district numbers remain part of the matching key. The North Harris County Regional Water Authority documents use Position and District for the same two declaration offices; that alias is restricted to that jurisdiction.

The follow-up [Travis review findings](travis-review-followup.md) preserve the distinction between direct document text and cross-document scope support:

- Mustang Ridge's cancellation order declares unopposed candidates elected and is dated September 14, 2026. It omits the election date. November scope is now corroborated by the county index and the official election order for one mayor and two councilmembers. The limitation remains attached, and no records are removed.
- The East Travis Gateway Library District cancellation link points to a general-election order form. Its PDF form fields contain November 3, 2026 and trustee offices, while the rendered page appears blank in those fields. Extracted text does not establish cancellation. The index classification and document content remain in conflict.

The PDFs contain 206 sparse/textless pages with Windows English OCR transcriptions. Original PDF text, form fields, and OCR text are stored separately. OCR records identify source SHA-256, page, engine, language, and 160-DPI rendering. Every transcription requires visual comparison before approval; no numerical confidence is invented. Sample visual checks established the layout, inspected bilingual measures and multi-seat races, compared the Mustang Ridge orders, and exposed the library form issue. They do not constitute exhaustive human composition review.

## Proposition variants

Travis ESD 10 prints Proposition A and B twice on page 18, columns 3 and 4. One pair includes the tax-increase warning. All four records match the official order's separate clauses for existing district voters and proposed annexation-territory voters, including the warning distinction. Separate electorate scopes and supporting order provenance are recorded while preserving variant identities and wording. Official ballot-style membership still needs verification. The 131 proposition count includes these source variants.

## Reproducibility and review

`pipelines/ingest.py` provides official link discovery, bounded retrieval, content-addressed archives, per-retrieval receipts, county layout extraction, supplemental reconciliation, immutable runs, and review-required diffs. The identity includes source hashes, kinds, source titles, adapter version, and OCR artifact hashes. Replays verify source PDF checksums before reusing a run. Changes and removals remain visible in the diff. Unassigned choice symbols or incomplete parsed records produce a failed intake.

- Travis run: `e6e281b299d87b472a22fc4f93f0055b75ac007adc9608dd868779f65b6f19ed`.
- Harris run: `67c719ac84ff4708811362e0d530baa35fcff9c091b3190a35f05af99df68ce2`.
- Travis master SHA-256: `fad1c5a7d794e59d23cb12f616c29c4ab3ff94571c04f61cb6aa89231babb3ea`.
- Harris master SHA-256: `0b35cb063ef0cb82001e2fb79141e259b95c330cd0d10ad7b2575e34d611e1ed`.

The ignored `data/official/REVIEW.md` packet lists staged records, bilingual measure wording, supplemental matches, source references, and open issues. Machine-readable results are in `latest/travis.json` and `latest/harris.json`. Original PDFs, HTML, OCR artifacts, and immutable runs remain in the same ignored store. Back it up separately from Git. Rendered review images are in ignored `output/ingestion/`.

## Publication boundary and remaining M2 work

The public `/official-data` page displays source metadata, checksums, aggregate coverage, staged counts, and review issues. It excludes candidate records, proposition text, form values, and machine transcriptions. The ballot explorer uses labeled synthetic fixtures. No official composition snapshot or individual ballot is published.

The [private review workflow](m2-review-workflow.md) implements transactional staging, RLS-protected tasks, authenticated reviewer functions, append-only decisions, and derived progress. The two current hosted runs have 677 open tasks and zero decisions; earlier runs remain preserved. The County Clerk qualification-source gap is closed. The [normalized mapping engine and publisher controls](m2-composition-publisher.md) are implemented, with incomplete private drafts for both counties. Remaining work includes the library cancellation conflict, explicit assignments and named mapping review, record-by-record source review, official jurisdictions/styles, trusted human style evidence, and runtime integration. Verified official address/style examples are required before personalized lookup. See the [current handoff](project-status.md).

## Current style-validation pass

The [ballot style comparison harness](m2-ballot-style-validation.md) rejects changed contest membership/order, candidate order, write-ins, voting instructions, bilingual proposition wording, electorate variants, invalid page coverage, and altered reference bytes. Both counties currently have zero independent individual-style references and zero address fixtures. Current public lookup forms require voter information and were left unsubmitted. M2 remains blocked for official style verification.

## Verification

- Last pipeline verification passed 26 Python tests covering extraction, supplemental reconciliation, immutable replay, qualification export, and style comparisons.
- Last implementation verification passed 141 Vitest tests, including 26 mapping/publisher cases, plus TypeScript and the production build.
- Sixteen mocked desktop/mobile browser flows and 44 live hosted Auth/API/publisher checks passed. Exhaustive human review remains pending.
- The live reviewer page is connected and includes read-only mapping status. Actual deployed desktop/mobile checks passed sign-in, current blockers, review filtering/pagination, overflow, and sign-out cleanup. No official snapshot or active pointer was created. Detailed deployment history is in [hosted verification](m2-hosted-verification.md).

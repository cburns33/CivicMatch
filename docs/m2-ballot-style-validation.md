# M2 ballot style validation

Current outcome, October 26, 2026: the comparison harness is implemented and tested. Travis and Harris each have zero independent individual-style references and zero official address fixtures. Both counties remain blocked for style verification. A county consolidated ballot supplies the contest universe; it does not establish which races belong on one person's ballot.

## Official access checks

The [Travis current-election page](https://votetravis.gov/current-election-information/current-election/) links its consolidated ballot, voter lookup, and [accessible ballot interface](https://tx.omniballot.us/sites/48453/default/app/home). Choosing View Your Accessible Sample Ballot opens a form requiring first name, last name, and birth date. The public election page still says Sample Ballots Coming Soon alongside its consolidated reference. No public per-style download index was established.

The [Harris ballot page](https://www.harrisvotes.com/Voter/Whats-on-my-Ballot) links the county sample, supplemental notices, and an embedded voter-specific search. The embedded form includes name, address, and certificate/VUID fields and reCAPTCHA. It was left unsubmitted. The public precinct map identifies precinct geography; no election-specific precinct-to-style crosswalk or complete contest membership was established from it.

Screenshots of these empty public forms are retained in ignored `output/playwright/`. No voter names, birth dates, VUIDs, registrations, or voter-specific search results were requested. A 403 from a research fetch is an access observation; it is not evidence that a candidate or ballot style is absent.

## Comparison contract

Run `python pipelines/validate_styles.py` after staging. It writes a private detailed report to `data/official/style-validation.json` and a public aggregate-only report to `src/data/official-style-status.json`. Exit code 2 means style validation remains blocked, including when no references exist. Public status must match the current import run IDs or the app build fails.

Independent transcriptions belong in ignored `data/official/style-references.json`, an array of objects containing `reference` and `proposedRecordIds`. No official fixtures are fabricated to populate this file. A reference identifies county, election date, current run ID, official source URL, style code, language, complete page coverage, archived PDF checksum/path, and `sourceScope: individual_style`. Each expected record identifies its staged record ID, source page, and independent `fields` transcription. Proposed membership is supplied separately, in ballot order. The reference's `records` list is the complete official style, including declaration blocks when present.

`comparison_fields` defines the compared fields: printed contest title, kind, voting instruction, printed candidate names/parties/order, blank write-in slot, separately qualified write-in names, bilingual measure wording, response option order, electorate scope, and declaration wording. Supplemental qualification lists must support the qualified write-in names separately when a style prints only a slot. A canceled office cannot be added or removed by a comparison note. Its official cancellation and the complete style reference must support the proposed composition.

Only layout whitespace is collapsed for comparison. Case, punctuation, amounts, tax warnings, names, language variants, and electorate variants remain meaningful. The original wording is unchanged in source storage. The comparator checks actual PDF page counts and bytes, rejects consolidated/import sources as independent references, binds the result to reference and membership checksums, and reports missing/extra contests, duplicates, changed order, missing provenance, or content mismatches.

A passing machine result is `comparison_passed_pending_review`. It never grants official verification, address eligibility, a reviewer decision, or publication. The current aggregate status stays blocked until a separate reviewed validation/publication workflow is implemented. The comparison harness is not connected to a trusted publisher.

## Required next evidence

Obtain official November 3, 2026 individual-style PDFs and the election-specific style membership/crosswalk from each county. The useful packet includes style codes, precinct subdivisions, jurisdictions, contest order, language versions, and corrections. Travis must cover the separate ESD 10 existing-district and annexation electorates. Both counties need write-in, multi-seat, uncontested/canceled, and proposition cases.

Public civic-address examples can follow when an official address-only service returns a ballot style without voter records. A volunteered private voter example would need separate authorization and privacy handling. Current public forms do not establish a permitted address-only path. No messages or records requests were sent to county staff.

## Verification

Seven new Python tests cover qualification export filters/status and omission of contact fields, complete comparisons, membership/order mistakes, wrong election/county/run, consolidated/partial references, candidate order, write-ins, vote limits, bilingual text, electorate scope, checksums, and page provenance. The current report returns blocked with zero references for each county. Synthetic unit cases remain labeled TEST and are excluded from official coverage counts.

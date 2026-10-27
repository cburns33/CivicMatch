# M2 technical plan: official election ingestion

Research date: October 26, 2026, America/Chicago. M1 implements models and synthetic fixtures only. The observations below identify accessible source surfaces, without claiming completed adapters, verified address fixtures, or a complete official ballot. No county API was established during this research.

## Source discovery

| Authority | Observed public format | Proposed adapter and limitation |
| --- | --- | --- |
| Texas Secretary of State | The [November 2026 election index](https://www.sos.texas.gov/elections/laws/2026-november-general-election.shtml) links candidate listings, ballot certification PDFs, write-in certification PDFs, and a sample ballot. | HTML discovery plus source-specific PDF extraction. State certification is a cross-check for covered offices; county records must supply local composition and ballot styles. No public ballot API was verified. |
| Travis County | The [current election page](https://votetravis.gov/current-election-information/current-election/) links an 18-page consolidated ballot PDF, [voter lookup](https://votetravis.gov/voter-lookup/), and an accessible personal-ballot interface. | Preserve the exact linked PDF revision and checksum. A consolidated ballot is a contest universe, not a personalized style. Lookup access and any automated-use permissions need separate validation. |
| Harris County | The [ballot page](https://www.harrisvotes.com/Voter/Whats-on-my-Ballot) links a 14-page bilingual sample ballot PDF, a separate write-in document, cancellations, and voter-specific ballot functionality. The PDF link uses Azure Blob hosting and a query signature. | Discover current links from the county page. Retain final retrieval metadata, avoiding hard-coded signed URLs as permanent identifiers. Validate write-ins and cancellations as separate inputs. The master PDF does not establish address eligibility. |
| Williamson County | The [official voter lookup](https://apps.wilcotx.gov/elections/voterlookup/) serves a JavaScript application. A publicly indexed sample-ballot PDF path exists, but the indexed example inspected is for 2025. | Verify current election and style identifiers through official navigation. Do not assume an older `BS1.pdf` path identifies the 2026 ballot. No documented API contract was verified. |
| Hays County | The [elections department page](https://www.hayscountytx.gov/172/Elections) links the November election. The [county voter/precinct lookup](https://mapps.hayscountytx.gov/election/index.cfm?lang=en) is an HTML form requiring name or VUID and date of birth. | Recheck the current election page and its document links in a permitted browser. Direct research requests to the November page failed. Its current PDF set and automated access remain unverified. Do not collect voter identifiers for bulk testing. |
| Fort Bend County | The [elections hub](https://www.fortbendcountytx.gov/government/departments/elections-voter-registration/elections-hub) links election resources. The [sample-ballot document host](https://sampleballots.fortbendcountytx.gov/) exposes a PHP directory listing and election folders. | Directory/link discovery followed by reviewed election-specific PDF selection. Confirm which documents cover November 2026; do not infer current styles from unrelated primary folders. |
| Montgomery County | The [November sample-ballot page](https://elections.mctx.org/samplebal.asp?ElectionId=GEN110326&curLang=English) is HTML, links a master sample ballot, and directs voters to registration lookup for their individual races. | Follow official election-scoped links and parse the linked document after format checks. The county explicitly distinguishes its master document from individual eligibility. |
| Google Civic Information | The [v2 reference](https://developers.google.com/civic-information/docs/v2) documents JSON election and voter-information endpoints. [voterInfoQuery](https://developers.google.com/civic-information/docs/v2/elections/voterInfoQuery) accepts an address, election ID, and `officialOnly`. | Treat as an optional corroboration adapter. No key-backed request or Austin/Houston coverage test was performed. Discover available elections, pin the target election, preserve per-record source attribution, and cross-check county records. An empty response cannot establish an empty ballot. |

The [SOS ballot preparation advisory](https://www.sos.texas.gov/elections/laws/advisory2026-22.shtml) identifies the county election officer as the ballot-preparation authority and notes limits in state candidate certifications. This supports a county-first composition workflow with state cross-checks. Publication must reconcile current replacements, write-ins, local offices, and cancellation notices.

## Adapter contract

Implement one Python adapter per authority and format version. Start with Travis and Harris document discovery and manual-reviewed staging. Add neighboring counties as separate adapters, without treating cities as counties. Reuse PDF parsing utilities only after each source’s layout has been characterized.

Each adapter must emit:

1. Source authority, original/final URL, retrieval time, MIME type, byte count, SHA-256, and checksum scope.
2. Archived bytes when permitted, or immutable permitted reference metadata with an explanation when archival is restricted.
3. Adapter name/version and source-specific stable record keys, page/section references, and exact extracted printed text.
4. Normalized jurisdictions, district references, election, styles, contests, entries, measures, and contest/style memberships.
5. A parse manifest accounting for all pages/sections, records read, records emitted, unsupported constructs, and errors.
6. An import diff, ambiguity/conflict queue, and validation report against identified official reference ballots.

Contract output is staged. A parser or LLM never publishes. Validate MIME type and actual content, cap document size, use bounded timeouts, and make missing pages or unexpected layout changes fatal for publication. Preserve the original text alongside any normalization. Preserve language variants separately before any translation design.

## Deterministic import transaction

1. Discover and retrieve a source after checking terms, access conditions, and any applicable archival limits. Do not bypass a login, challenge, or rate limit. Record inaccessible sources as blocked research.
2. Hash and archive. Reuse the existing source record for the same authority/checksum/scope. A new retrieval of identical bytes may need a separate retrieval-event table in M2 to preserve every observation; M1 stores the first immutable source retrieval.
3. Find the existing run by source, adapter, and adapter version. Reuse its outcome on repeat import. An adapter revision gets a new run. Concurrency must use transaction-safe uniqueness and conflict handling.
4. Parse into staging without mutating the last published snapshot. Stable official keys identify entities. Names alone cannot merge person identities. Unicode and whitespace normalization never overwrite printed names or proposition wording.
5. Produce an exhaustive diff against the last approved import. Missing candidates/contests are removal proposals requiring review. Parse errors remain visible records and must not be interpreted as removals.
6. Validate all relationships with Zod and SQL constraints, plus source counts and page-level completeness. Build an official-reference comparison report for every covered ballot style, including candidate order, exact wording, write-ins, and uncontested/canceled contests.
7. A reviewer resolves identities, consequential changes, and conflicts. Approval requires a named reviewer, reference-ballot check, schema version, completion timestamp, and no unresolved issues. Review flags must derive from the issue queue, not a manually decremented count alone.
8. A trusted server-side publisher validates all contributing runs and creates one immutable, schema-versioned snapshot. Confirm its checksum and read it through the intended client role. Publish composition separately from research availability. Update the active-snapshot pointer only after validation succeeds.

M1 constraints establish uniqueness and referential foundations. M2 must implement transactional imports, full payload validation, coordinating-run membership, an active-snapshot pointer, archive storage access controls, and the publication service. Client roles cannot publish snapshots.

## Official address-to-ballot fixture suite

There are **zero official address-to-ballot fixtures in M1**. The synthetic city datasets are not eligibility fixtures. Acquire official examples with the user’s permission and lawful access, avoiding private voter records or fabricated expected styles. Prefer public civic addresses where the official lookup supports them, or redact volunteered examples with a documented privacy policy.

Each fixture must identify the official authority, target election, retrieval date, source document/reference and checksum, verified ballot style, exact expected contest set/order, relevant district memberships, and the reviewer. Keep any private address/lookup identifiers in an access-controlled test store, outside Git and client bundles.

Required matrix before address matching can ship:

- Multiple precincts and ballot-style subdivisions in Travis and Harris.
- Austin boundary cases across Travis, Williamson, and Hays, where confirmed applicable.
- Houston boundary cases across Harris, Fort Bend, and Montgomery, where confirmed applicable.
- School and special-district boundaries that split a precinct or city.
- Multiple language versions, qualified write-ins, uncontested and canceled elections, special contests, propositions, and corrections.
- Ambiguous addresses, no match, stale geography, conflicting sources, boundary points, and an official lookup outage.

Geometry can propose district memberships. Only a verified official style/reference match can establish the displayed ballot as verified. If no official match is available, show an unverified limitation and a link to the relevant county lookup. Do not silently substitute a citywide or countywide master ballot.

## Delivery order and M2 acceptance

1. Capture permitted source references and build an archive manifest. Verify reproducible checksum retrieval without changing immutable source rows.
2. Implement and test Travis/Harris staging adapters against reviewed small document samples. Verify exact text and full error accounting.
3. Build the review/diff workflow and trusted publisher. Run full Supabase reset, advisors, and role/API tests in an isolated environment.
4. Establish official address/style fixtures and a source-specific verification path before enabling address lookup.
5. Add neighboring counties and test cross-county coverage before calling either city complete.

Accept M2 only when repeat imports are idempotent, every parsed or failed source section is accounted for, removed records require review, all contributing sources are traceable, reference-ballot comparisons pass, snapshots are immutable, and unverified eligibility fails to an honest limitation state. Candidate position research remains a separate milestone with its own human-review gates.

# Unified issue quiz and Senate coverage, October 27, 2026

The user clarified that the product should have one quiz organized by issue, with comparisons to all available politicians at the end. This supersedes the race-by-race questionnaire design. The audience remains the user and friends, with sourced provisional mappings authorized for publication.

## Experience

The homepage has fourteen questions across five sections: economy and housing; health and family; rights and personal freedom; education; safety and immigration. Users can navigate sections, answer or skip, rate importance, review all answers, and then compare every candidate in current coverage. No race selection is required. State and federal questions identify the office they apply to.

Results show all fourteen candidates, grouped by office in certification order, including eight qualified write-ins. Each result uses the seven questions relevant to that office. Answering fourteen questions does not increase a Senate or governor candidate's applicable denominator beyond seven. Unsupported candidates remain visible. The existing five-comparison and 60% coverage gates remain, along with equal-weight and high-priority sensitivity views. Results provide no endorsement or ranking.

The earlier comparison renderer is reused for results, with supplied answers and a race-specific question set. Its race questionnaire remains only in the private governor research workspace. The public entry is `IssueQuiz`, which reveals all candidate comparisons after the shared issue quiz and review. No separate Senate questionnaire or race selector was added.

## Research

Governor research remains `tx-governor-2026-10-27-v2-provisional`: fifteen mapped positions, five per printed candidate, with four write-ins retained. Senate research is `tx-senate-2026-10-27-v1-provisional`: eighteen numeric mappings and three explicit exclusions across fourteen archived public pages.

- Ken Paxton: five mapped questions, including dated ACA/abortion records, a private-firearm-sales challenge, a tariff response, and border-wall policy. Legal arguments and inferred policy direction are separate in the gun entry; the ACA entry identifies its 2018 date and provisional current interpretation.
- James Talarico: six mapped questions on reproductive protection, background checks, tariffs, ACA preservation, federal cannabis policy, and paid family leave. His broad border plan is not assigned an unsupported barrier-funding position.
- Ted Brown: five mapped questions from his own platform. The ACA entry is an explicit provisional inference from his opposition to government healthcare intervention; it does not claim a specific repeal pledge. No party platform supplies a missing stance.
- Bradford "Brad" Hall: two mapped questions on targeted barriers and regulated federal marijuana reform. His limited scope and unsettled details remain visible.
- Avery Ayers, Zul Mohamed, and Jade Simmons: current campaign pages are linked, with three source-backed explanations for why general border/healthcare goals do not establish the specific quiz position. Their missing mappings remain null.

The state certification establishes printed names and write-in qualifications. Campaign sources establish what candidates say, and official records establish dated actions. Qualitative evidence labels and AI interpretations are separate from numerical agreement. No insider motive allegations enter the scorer. Human reviewer/date fields remain null for the provisional packet. Source bytes are archived under ignored `data/official/senate-research/`; public source URLs, hashes, retrieval times, known publication dates, rationale, and limits are versioned with the packet. The archiver checks expected source text and caps small-page retrievals at 1 MB.

## Answers and privacy

The unified key is `civicmatch:issue-quiz-v1`. On the first visit, valid earlier governor revision IDs migrate from `civicmatch:governor-questions-v1` if no unified record exists. Federal answers remain untouched. Migration records a versioned unified copy; an existing unified record always takes precedence. Clearing answers removes both keys so old responses cannot reappear. Bad saved data is discarded. Political answers remain in browser localStorage and memory, with no account or server submission.

## Verification

169 Vitest checks, 24 desktop/mobile Chromium flows, and the production build passed. New checks cover the full five-issue journey into all fourteen results, separate office denominators, source inspection, sparse write-in coverage, neutral/skip states, importance, navigation/editing, reload persistence, legacy migration without federal answers, clearing both stores, corrupt data, and anonymous private-API denial. Public quiz flows sent zero political-answer writes.

Core release `23f2ff065c69ecebec1223d29a931b0f747936ce` deployed READY as `dpl_4deNxnpYUWFC9DxCoisnaYCe1yJW`, assigned to https://civicmatch-tx.vercel.app. Actual desktop (1365×900) and mobile (390×844) journeys passed the complete fourteen-question, five-issue quiz into all fourteen comparisons. The checks changed importance and verified six expected numerical results, inspected the gun-policy source and its interpretive limits, confirmed Hall's sparse coverage, and exercised reload persistence and clearing. A fresh browser context verified migration from the earlier governor store without federal answer inference or resurrection after clearing. Both journeys had zero political-answer writes, browser errors, or overflow. Screenshots and the bounded report are ignored under `output/playwright/issue-*`.

The comparison renderer also retains a working private-preview source anchor, and source retrieval dates display in America/Chicago while full UTC timestamps remain in the research packet. No Supabase schema, county import decision, composition publication, active pointer, paid capability, or address lookup changed. Full M2 remains incomplete.

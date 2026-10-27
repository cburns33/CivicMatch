# Official source intake

The M2 county adapter archives the Travis and Harris November 3, 2026 consolidated sample ballots, Harris's write-in/cancellation notices, all 51 cancellation orders linked under Travis's November index, and the Texas SOS certified write-in list. Two added official orders provide targeted first-page scope references for ESD 10 and Mustang Ridge. All master pages are staged with printed names, party labels, order, multi-seat voting instructions, bilingual measure wording, response options, declaration blocks, and source page/column/bounds/checksums. Named write-ins are matched to unique offices with printed slots. Cancellation scopes produce review-only reconciliation results and never remove records.

## Setup and commands

Use Python 3.11+ with the pinned dependencies in `pyproject.toml`. A virtual environment is recommended.

```powershell
python -m venv pipelines/.venv
pipelines/.venv/Scripts/python -m pip install pdfplumber==0.11.9 pypdf==6.19.0
pipelines/.venv/Scripts/python pipelines/ingest.py fetch
pipelines/.venv/Scripts/python pipelines/ocr_notices.py
pipelines/.venv/Scripts/python pipelines/ingest.py stage
pipelines/.venv/Scripts/python -m unittest discover -s pipelines -p 'test_*.py' -v
```

`fetch` discovers current official links from county and state election pages, downloads their documents, and stages an initial run. It checks content types, signatures, official hostnames, file limits, and election dates. The archived November cancellation index must account for every Travis cancellation document. It records every retrieval, including repeat retrievals of identical documents. It does not access voter-registration records.

On Windows, `ocr_notices.py` renders sparse/textless cancellation pages at 160 DPI and calls the built-in Windows English OCR engine through `ocr_windows.ps1`. It needs the installed en-US recognizer. Original text, PDF form fields, and machine transcriptions remain separate. OCR files identify source SHA-256, page, engine, language, and render resolution. They are unverified review aids. Run `stage` afterward to include their hashes in a new immutable run. OCR files are retained unchanged on repeat execution; a deliberate replacement changes the run identity.

`stage` replays the archived source manifest without a network request. Each source PDF is checked against its archived SHA-256 before reuse. Source bytes and run artifacts are immutable; identical source hashes and adapter versions reuse the same run. New source bytes or a new adapter version produce a new run and a diff. All additions, changes, and removals require review. A parsing problem becomes an explicit issue and blocks approval.

The local store is `data/official/`, ignored by Git and Vercel uploads. It contains `documents/`, `retrievals/`, `ocr/`, `runs/`, `latest/`, the source manifest, failure receipts, and `REVIEW.md`. The review packet lists all staged entries, measure wording, supplemental matches, and provenance. Run artifacts retain raw text, form values, column coverage, and unreviewed structured records. Rendered review images are in ignored `output/ingestion/`. Keep the store when moving this project to preserve the source archives.

The generated `src/data/official-source-status.json` contains only source metadata and aggregate intake status for the public `/official-data` page. Candidate names and transcript text stay outside that artifact. Signed county document URLs can expire; the stable county source pages remain linked alongside them.

## Review boundary

This adapter does not approve or publish ballot composition, merge people by name, determine jurisdiction/district membership, or verify addresses. The [separate review workflow](../docs/m2-review-workflow.md) consumes its immutable runs through a transactional import. A printed blank write-in slot is distinct from a declared write-in candidate. Supplemental matches remain unapproved. Repeated proposition captions retain separate variant identities; electorate scope is added only when all four ESD 10 clauses match the official order by wording, letter, and warning. The Travis County Clerk write-in slot remains unnamed pending a local certification.

Before approval, compare every normalized record with the identified PDF page, reconcile supplemental notices and identities, account for remaining source sections, validate official styles, and record a human review decision. The [M2 intake report](../docs/m2-intake.md) records the current scope and remaining work; the [ingestion plan](../docs/ingestion-plan.md) defines the broader milestone.

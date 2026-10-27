"""Public county reference documents, archived and staged without publication.

Run from the repository root: python pipelines/ingest.py fetch
No addresses, voter identifiers, candidate positions, or cloud credentials are used.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

import pdfplumber
from pypdf import PdfReader
import full_ballot
import supplements
import candidate_export

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_STORE = ROOT / "data" / "official"
ADAPTER_VERSION = "county-reference-v4"
ELECTION_DATE = "2026-11-03"
SOURCES = {
    "travis": "https://votetravis.gov/current-election-information/current-election/",
    "harris": "https://www.harrisvotes.com/Voter/Whats-on-my-Ballot",
}
ALLOWED_HOSTS = {"votetravis.gov", "www.harrisvotes.com", "hctxdnnstg.blob.core.windows.net", "www.sos.state.tx.us", "www.sos.texas.gov"}
PARTIES = {"Republican Party": "REP", "Democratic Party": "DEM", "Libertarian Party": "LIB", "Green Party": "GRN"}


def canonical(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def write_immutable(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with path.open("xb") as target:
            target.write(data)
    except FileExistsError:
        if path.read_bytes() != data:
            raise ValueError(f"Immutable artifact differs: {path.name}")


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.href: str | None = None
        self.parts: list[str] = []
        self.links: list[tuple[str, str]] = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.href = dict(attrs).get("href")
            self.parts = []

    def handle_data(self, data):
        if self.href:
            self.parts.append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self.href:
            self.links.append((" ".join(" ".join(self.parts).split()), self.href))
            self.href = None


def discover(county: str, html: str) -> dict[str, dict]:
    parser = LinkParser()
    parser.feed(html)
    selected: dict[str, dict] = {}
    for title, href in parser.links:
        label = title.lower()
        kind = None
        if "2026" in label and ("consolidated ballot" in label or "sample ballot" in label):
            kind = "master_ballot"
        elif county == "harris" and "write-in candidates" in label:
            kind = "write_ins"
        elif county == "harris" and "notice of cancellations" in label:
            kind = "cancellations"
        if kind:
            item = {"title": title, "url": urljoin(SOURCES[county], href)}
            if kind in selected and selected[kind] != item:
                raise ValueError(f"Conflicting {county} {kind} links require review")
            selected[kind] = item
    expected = {"master_ballot"} if county == "travis" else {"master_ballot", "write_ins", "cancellations"}
    if set(selected) != expected:
        raise ValueError(f"Missing required {county} sources: {expected - set(selected)}")
    return selected


def retrieve(url: str, expected_pdf: bool) -> tuple[bytes, str, str]:
    if urlparse(url).scheme != "https" or urlparse(url).hostname not in ALLOWED_HOSTS:
        raise ValueError("Source URL is outside the official source allowlist")
    request = Request(url.replace(" ", "%20"), headers={"User-Agent": "CivicMatchTX/0.2 ballot-source research"})
    with urlopen(request, timeout=60) as response:
        final_url = response.url
        if urlparse(final_url).scheme != "https" or urlparse(final_url).hostname not in ALLOWED_HOSTS:
            raise ValueError("Source redirected outside the official source allowlist")
        media_type = response.headers.get_content_type()
        body = response.read(20_000_001)
    if len(body) > 20_000_000:
        raise ValueError("Document exceeds the 20 MB intake limit")
    if expected_pdf and (media_type != "application/pdf" or not body.startswith(b"%PDF-")):
        raise ValueError("Expected an official PDF; unexpected content requires review")
    if not expected_pdf and media_type != "text/html":
        raise ValueError("Expected an official HTML discovery page")
    return body, final_url, media_type


def archive(store: Path, county: str, kind: str, title: str, url: str, discovery_hash: str | None = None, discovery_url: str | None = None) -> dict:
    body, final_url, media_type = retrieve(url, kind != "discovery_page")
    return archive_received(store,county,kind,title,body,final_url,media_type,discovery_hash,discovery_url)


def archive_received(store,county,kind,title,body,final_url,media_type,discovery_hash=None,discovery_url=None):
    sha = digest(body)
    extension = "html" if kind == "discovery_page" else "pdf"
    relative = f"documents/{sha}.{extension}"
    write_immutable(store / relative, body)
    record = {"county": county, "kind": kind, "title": title, "discoveryUrl": discovery_url or SOURCES[county],
              "discoverySha256": discovery_hash, "url": final_url, "sha256": sha, "bytes": len(body),
              "mediaType": media_type, "checksumScope": "document_bytes", "archivePath": relative}
    # Every retrieval is recorded, including repeat retrievals of identical bytes.
    receipt = {**record, "retrievedAt": datetime.now(timezone.utc).isoformat()}
    write_immutable(store / "retrievals" / f"{county}-{kind}-{digest(canonical(receipt))}.json", canonical(receipt))
    return receipt


class NoticeParser(LinkParser):
    def __init__(self):
        super().__init__()
        self.heading=None
        self.heading_parts=[]
        self.election=""
        self.section=""
        self.notices=[]

    def handle_starttag(self,tag,attrs):
        super().handle_starttag(tag,attrs)
        if tag in ["h3","h4"]:
            self.heading=tag
            self.heading_parts=[]

    def handle_data(self,data):
        super().handle_data(data)
        if self.heading:
            self.heading_parts.append(data)

    def handle_endtag(self,tag):
        if tag==self.heading:
            label=" ".join(" ".join(self.heading_parts).split())
            if tag=="h3": self.election=label
            else: self.section=label
            self.heading=None
        if tag=="a" and self.href and "November 3, 2026" in self.election and "Cancelled" in self.section:
            self.notices.append({"title":" ".join(" ".join(self.parts).split()),"url":urljoin("https://votetravis.gov/resources/required-notices/",self.href)})
        super().handle_endtag(tag)


def fetch_extended_sources(store):
    """Additional scope explicitly approved by the user on October 26."""
    result=[]
    notices_url="https://votetravis.gov/resources/required-notices/"
    landing=archive(store,"travis","discovery_page","Travis November 2026 required notices",notices_url,discovery_url=notices_url)
    result.append(landing)
    parser=NoticeParser()
    parser.feed((store/landing["archivePath"]).read_text(encoding="utf-8-sig"))
    if not parser.notices:
        raise ValueError("No November 2026 Travis cancellation links were found")
    # Fetch independently, then write archives in discovery order to avoid races
    # when two official links point to identical bytes.
    with ThreadPoolExecutor(max_workers=4) as pool:
        downloads=pool.map(lambda link:retrieve(link["url"],True),parser.notices)
        for link,(body,url,mime) in zip(parser.notices,downloads):
            result.append(archive_received(store,"travis","cancellations",link["title"],body,url,mime,landing["sha256"],notices_url))
    state_url="https://www.sos.texas.gov/elections/laws/2026-november-general-election.shtml"
    state_page=archive(store,"travis","discovery_page","Texas SOS November 2026 election index",state_url,discovery_url=state_url)
    result.append(state_page)
    links=LinkParser()
    links.feed((store/state_page["archivePath"]).read_text(encoding="utf-8-sig"))
    matches=[(title,urljoin(state_url,url)) for title,url in links.links if "2026" in title and "write-in" in title.casefold() and "certified" in title.casefold()]
    if len(matches)!=1:
        raise ValueError("State write-in certification link is missing or ambiguous")
    title,url=matches[0]
    result.append(archive(store,"travis","write_ins",title,url,state_page["sha256"],state_url))
    for title, url in [
        ("ESD 10 election order", "https://votetravis.gov/wp-content/uploads/TCESD-NO.-10-ELECTION-ORDER-LONG-KPC-082326.pdf"),
        ("Mustang Ridge election order", "https://votetravis.gov/wp-content/uploads/City-of-Mustang-Ridge_Order-of-Election.pdf"),
    ]:
        result.append(archive(store,"travis","supporting_reference",title,url,landing["sha256"],notices_url))
    return result


def validate_cancellation_inventory(store, sources):
    """Every link in the archived November cancellation index must be present."""
    index = next((s for s in sources if s["kind"] == "discovery_page" and s["url"] == "https://votetravis.gov/resources/required-notices/"), None)
    if not index:
        raise ValueError("Travis cancellation discovery page is required")
    if not re.fullmatch(r"[a-f0-9]{64}", index["sha256"]) or index["archivePath"] != f"documents/{index['sha256']}.html":
        raise ValueError("Invalid cancellation discovery archive reference")
    path = store / index["archivePath"]
    content = path.read_bytes()
    if digest(content) != index["sha256"]:
        raise ValueError("Cancellation discovery page checksum mismatch")
    parser = NoticeParser()
    parser.feed(content.decode("utf-8-sig"))
    expected = sorted(link["title"] for link in parser.notices)
    actual = sorted(s["title"] for s in sources if s["county"] == "travis" and s["kind"] == "cancellations" and s.get("discoverySha256") == index["sha256"])
    if not expected or expected != actual:
        raise ValueError("Cancellation source inventory differs from the archived November index")


def horizontal(obj: dict) -> bool:
    return obj.get("object_type") != "char" or abs(obj.get("matrix", (1, 0))[1]) < 0.01


def federal_sections(lines: list[str], county: str) -> list[dict]:
    """Scope is first-page federal contests only. Unknown content is fatal here."""
    records: list[dict] = []
    current: dict | None = None
    pending_name: list[str] = []
    for line in lines:
        line = line.strip()
        if line == "State Offices":
            break
        if line.startswith("United States Senator") or line.startswith("United States Representative"):
            if pending_name:
                raise ValueError("Candidate name has no party label")
            current = {"printedTitle": line, "candidates": [], "writeInSlot": False, "rawLines": [line]}
            records.append(current)
            continue
        if current is None:
            continue
        current["rawLines"].append(line)
        if not current["candidates"] and (line.startswith("District ") or (line.isdigit() and current["printedTitle"].endswith("District"))):
            current["printedTitle"] += " " + line
            continue
        if re.search(r"W\s*rite-in", line, re.I):
            current["writeInSlot"] = True
            continue
        if not line or line == "Vote for none or one":
            continue
        if county == "travis":
            match = re.fullmatch(r"(.+?)\s*\((REP|DEM|LIB|GRN)\)", line)
            if not match:
                raise ValueError(f"Unrecognized Travis candidate line: {line}")
            name, party = match.groups()
        else:
            if line not in PARTIES:
                pending_name.append(line)
                continue
            if not pending_name:
                raise ValueError("Party label has no candidate name")
            name, party = " ".join(pending_name), PARTIES[line]
            pending_name = []
        current["candidates"].append({"printedName": name, "normalizedName": " ".join(name.casefold().split()),
                                       "printedParty": f"({party})" if county == "travis" else line,
                                       "partyCode": party, "ballotOrder": len(current["candidates"]) + 1})
    if pending_name or any(not r["candidates"] for r in records):
        raise ValueError("Incomplete federal contest requires review")
    return records


def extract_document(store: Path, source: dict) -> dict:
    path = store / source["archivePath"]
    if digest(path.read_bytes()) != source["sha256"]:
        raise ValueError("Archived source checksum mismatch")
    if source["mediaType"] == candidate_export.MIME:
        if source["kind"] != "supporting_reference" or source["title"] != candidate_export.TITLE or source["url"] != candidate_export.PORTAL:
            raise ValueError("Unsupported workbook reference")
        return candidate_export.extract(path, source)
    pages, records, issues, coverage = [], [], [], []
    form_fields = {key: str(value.get("/V", "")) for key, value in (PdfReader(path).get_fields() or {}).items()} if source["kind"] == "cancellations" else {}
    ocr_path = store / "ocr" / f"{source['sha256']}.json"
    ocr = json.loads(ocr_path.read_text(encoding="utf-8")) if ocr_path.exists() else None
    if ocr and ocr["sourceSha256"] != source["sha256"]:
        raise ValueError("OCR transcription references different source bytes")
    with pdfplumber.open(path) as pdf:
        for number, page in enumerate(pdf.pages, 1):
            if source["kind"] == "supporting_reference" and number > 1:
                pages.append({"page": number, "text": "", "status": "outside_targeted_reference_scope"})
                continue
            text = page.filter(horizontal).extract_text(x_tolerance=1, y_tolerance=3) or ""
            pages.append({"page": number, "text": text, "status": "text_preserved" if text.strip() else "needs_ocr"})
            machine = next((p for p in ocr["pages"] if p["page"] == number), None) if ocr else None
            if machine:
                pages[-1].update({"ocrText": machine["text"], "ocrEngine": ocr["engine"], "status": "unverified_machine_transcription"})
            elif not text.strip():
                issues.append({"code": "needs_ocr", "page": number, "message": "Page has no extractable text or machine transcription; visual review is required."})
        if source["kind"] == "master_ballot":
            if not re.search(r"November\s+3,?\s+2026", pages[0]["text"], re.I):
                raise ValueError("Master ballot election date does not match November 3, 2026")
            records, layout_issues, coverage = full_ballot.extract_master(pdf, source["county"], source)
            issues.extend(layout_issues)
            if len({r["id"] for r in records}) != len(records):
                issues.append({"code": "duplicate_identity", "message": "Repeated contest key requires review."})
            issues.extend([
                {"code": "ballot_styles_unverified", "message": "Consolidated county reference has no verified address-to-style membership."},
            ])
        write_ins, cancellations = [], []
        if source["kind"] == "write_ins":
            if not supplements.has_election_date(pages[0]["text"]):
                raise ValueError("Write-in certification election date mismatch")
            write_ins = supplements.parse_write_ins(pdf, source)
        if source["kind"] == "cancellations":
            cancellations = supplements.parse_cancellations(pdf, source, pages, form_fields)
    if ocr:
        issues.append({"code": "ocr_review_required", "message": f"{len(ocr['pages'])} pages in {source['title']} have unverified Windows OCR text. Compare the archived page images before approval."})
    return {"source": source, "pages": pages, "records": records, "issues": issues, "coverage": coverage,
            "writeIns": write_ins, "cancellations": cancellations, "formFields": form_fields}


def import_diff(previous: list[dict], current: list[dict]) -> list[dict]:
    before, after = {r["id"]: r for r in previous}, {r["id"]: r for r in current}
    if len(before) != len(previous) or len(after) != len(current):
        raise ValueError("Duplicate contest identities cannot be diffed")
    changes = []
    for key in sorted(before.keys() | after.keys()):
        if before.get(key) != after.get(key):
            change = "added" if key not in before else "removed" if key not in after else "changed"
            changes.append({"recordId": key, "change": change, "before": before.get(key), "after": after.get(key), "reviewRequired": True})
    return changes


def stage(store: Path, county: str, sources: list[dict]) -> dict:
    selected = sorted((s for s in sources if s["county"] == county and s["kind"] != "discovery_page"), key=lambda s: (s["kind"], s["sha256"], s.get("title", "")))
    expected = {"master_ballot", "write_ins", "cancellations"}
    kinds = {s["kind"] for s in selected}
    if (not expected <= kinds or not kinds <= expected | {"supporting_reference"} or any(sum(s["kind"] == kind for s in selected) != 1 for kind in ["master_ballot", "write_ins"])
            or len({(s["kind"], s["sha256"], s.get("title", "")) for s in selected}) != len(selected)):
        raise ValueError("County intake requires its master ballot and all configured supplements")
    for source in selected:
        extension = "xlsx" if source.get("mediaType") == candidate_export.MIME else "pdf"
        if not re.fullmatch(r"[a-f0-9]{64}", source["sha256"]) or source["archivePath"] != f"documents/{source['sha256']}.{extension}":
            raise ValueError("Invalid content-addressed archive reference")
        if digest((store / source["archivePath"]).read_bytes()) != source["sha256"]:
            raise ValueError("Archived source checksum mismatch")
    identity = {"county": county, "adapterVersion": ADAPTER_VERSION, "sources": [{"kind": s["kind"], "sha256": s["sha256"], "title": s.get("title", ""),
                "ocrSha256": digest((store / "ocr" / f"{s['sha256']}.json").read_bytes()) if (store / "ocr" / f"{s['sha256']}.json").exists() else None} for s in selected]}
    run_id = digest(canonical(identity))
    run_path = store / "runs" / f"{run_id}.json"
    if run_path.exists():
        return json.loads(run_path.read_text(encoding="utf-8"))
    documents = [extract_document(store, source) for source in selected]
    records = [record for document in documents for record in document["records"]]
    scope_issues = supplements.resolve_reference_scopes(records, documents)
    reconciliation = supplements.reconcile(records, documents)
    reconciliation["issues"].extend(scope_issues)
    latest_path = store / "latest" / f"{county}.json"
    previous = json.loads(latest_path.read_text(encoding="utf-8")) if latest_path.exists() else None
    parse_failed = any(i["code"] in {"parse_error", "duplicate_identity", "unassigned_choices", "candidate_parse_incomplete", "measure_parse_incomplete", "unclassified_region"} for d in documents for i in d["issues"])
    result = {"schemaVersion": 2, "runId": run_id, "county": county, "electionDate": ELECTION_DATE,
              "adapterVersion": ADAPTER_VERSION, "status": "failed" if parse_failed else "needs_review", "referenceScope": "county_consolidated",
              "parseScope": "all_master_pages_and_supplements", "previousRunId": previous["runId"] if previous else None,
              "documents": documents, "records": records, "reconciliation": reconciliation,
              "diff": import_diff(previous["records"] if previous else [], records)}
    write_immutable(run_path, canonical(result))
    latest_path.parent.mkdir(parents=True, exist_ok=True)
    latest_path.write_bytes(canonical(result))
    return result


def source_status(run: dict) -> dict:
    return {"county": run["county"], "electionDate": run["electionDate"], "runId": run["runId"],
            "adapterVersion": run["adapterVersion"], "status": run["status"], "referenceScope": run["referenceScope"],
            "parseScope": run["parseScope"], "stagedContestCount": sum(r["kind"] == "candidate_contest" for r in run["records"]),
            "stagedCandidateCount": sum(len(r["candidates"]) for r in run["records"]),
            "stagedMeasureCount": sum(r["kind"] == "measure" for r in run["records"]),
            "declarationBlockCount": sum(r["kind"] == "declaration" for r in run["records"]),
            "sourceChoiceCount": sum(c["choiceCount"] for d in run["documents"] for c in d["coverage"]),
            "assignedChoiceCount": sum(c["assignedChoiceCount"] for d in run["documents"] for c in d["coverage"]),
            "matchedWriteInCount": sum(w["matchStatus"] == "matched_slot" for w in run["reconciliation"]["writeIns"]),
            "scopeSupportedMeasureCount": sum(bool(r.get("electorateScope")) for r in run["records"]),
            "corroboratedCancellationScopeCount": sum(n["dateEvidence"] == "cross_document_scope" for n in run["reconciliation"]["cancellations"]),
            "cancellationScopeCount": len(run["reconciliation"]["cancellations"]),
            "cancellationMatches": {key: sum(n["matchStatus"] == key for n in run["reconciliation"]["cancellations"]) for key in ["corroborates_declaration", "possible_active_conflict", "measure_only_scope", "no_matching_master_record", "scope_review_required"]},
            "issues": [issue for doc in run["documents"] for issue in doc["issues"]] + run["reconciliation"]["issues"],
            "sources": [{**doc["source"], "pageCount": len(doc["pages"]),
                         "extractionScope": "filtered_workbook" if doc["source"]["mediaType"] == candidate_export.MIME else "targeted_first_page" if doc["source"]["kind"] == "supporting_reference" else "all_pages",
                         "pagesWithText": sum(bool(p["text"].strip()) for p in doc["pages"]),
                         "pagesWithOcr": sum("ocrText" in p for p in doc["pages"])} for doc in run["documents"]]}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["fetch", "stage"])
    parser.add_argument("--store", type=Path, default=DEFAULT_STORE)
    args = parser.parse_args()
    args.store.mkdir(parents=True, exist_ok=True)
    manifest_path = args.store / "source-manifest.json"
    if args.command == "fetch":
        sources = []
        for county, url in SOURCES.items():
            landing = archive(args.store, county, "discovery_page", f"{county.title()} official election source page", url)
            sources.append(landing)
            html = (args.store / landing["archivePath"]).read_text(encoding="utf-8-sig")
            for kind, link in discover(county, html).items():
                sources.append(archive(args.store, county, kind, link["title"], link["url"], landing["sha256"]))
        sources.extend(fetch_extended_sources(args.store))
        browser_manifest = args.store / "browser-reference-manifest.json"
        if browser_manifest.exists():
            sources.extend(json.loads(browser_manifest.read_text(encoding="utf-8")))
        manifest_path.write_bytes(canonical(sources))
    else:
        sources = json.loads(manifest_path.read_text(encoding="utf-8"))
    validate_cancellation_inventory(args.store, sources)
    runs = [stage(args.store, county, sources) for county in SOURCES]
    review_lines = ["# Official county reference intake, pending review", "", f"Election: {ELECTION_DATE}. Adapter: {ADAPTER_VERSION}.", "", "Scope: all master pages, named write-ins and cancellations. No address/style matching or approved composition snapshot. OCR text is unverified.", ""]
    for run in runs:
        review_lines.extend([f"## {run['county'].title()} County", "", f"Run: `{run['runId']}`. Status: {run['status']}.", ""])
        for record in run["records"]:
            review_lines.extend([f"### {record['printedTitle']}", "", f"Source page {record['sourcePage']}, column {record['sourceColumn']}. Source SHA-256: `{record['sourceSha256']}`.", ""])
            review_lines.extend([f"Kind: {record['kind']}. Section: {record['sourceSection']}. Voting instruction: {record.get('voteInstruction') or 'not printed in this region'}.", ""])
            if record.get("electorateScope"):
                review_lines.extend([f"Electorate scope: {record['electorateScope']}. Official order SHA-256 `{record['scopeEvidence']['sourceSha256']}`, page 1. Scope support awaits composition review.", ""])
            review_lines.extend(f"- {candidate['printedName']} {candidate.get('printedParty') or ''}" for candidate in record["candidates"])
            review_lines.extend(f"- Declared write-in: {candidate['printedName']}, certification SHA-256 `{candidate['sourceSha256']}`, page {candidate['sourcePage']}." for candidate in record["declaredWriteIns"])
            for language, wording in record.get("wordingByLanguage", {}).items():
                review_lines.extend([f"#### Printed measure wording ({language})", "", wording, ""])
            if record["kind"] == "declaration":
                review_lines.extend([record["declarationText"], ""])
            review_lines.extend([f"- Write-in slot printed: {'yes' if record['writeInSlot'] else 'no'}.", ""])
        review_lines.extend(["### Supplemental reconciliation", ""])
        for item in run["reconciliation"]["writeIns"]:
            review_lines.append(f"- {item['printedOffice']}: {item['printedName']}, {item['matchStatus']}. Source `{item['sourceSha256']}`, page {item['sourcePage']}.")
        for item in run["reconciliation"]["cancellations"]:
            review_lines.append(f"- {item['printedScope']}: {item['matchStatus']}. Date evidence: {item['dateEvidence']}. Source `{item['sourceSha256']}`, pages {item['sourcePages']}. Matching records: {', '.join(item['matchedRecordIds']) or 'none'}. No records removed.")
            if item.get("scopeLimitation"):
                review_lines.append(f"  Scope limitation: {item['scopeLimitation']} Supporting source `{item['supportingSourceSha256']}`, page 1.")
        review_lines.extend(["### Open review issues", ""])
        review_lines.extend(f"- {issue['message']}" for doc in run["documents"] for issue in doc["issues"])
        review_lines.extend(f"- {issue['message']}" for issue in run["reconciliation"]["issues"])
        review_lines.append("")
    (args.store / "REVIEW.md").write_text("\n".join(review_lines), encoding="utf-8")
    status = {"schemaVersion": 2, "electionDate": ELECTION_DATE, "counties": [source_status(run) for run in runs]}
    # Only source metadata and aggregate staging status enter the public app.
    # Unreviewed candidate names and source-page text remain in the local store.
    summary = ROOT / "src" / "data" / "official-source-status.json"
    summary.write_bytes(canonical(status))
    for run in runs:
        print(json.dumps({"county": run["county"], "runId": run["runId"], "status": run["status"],
                          "stagedContests": len(run["records"]), "parseErrors": sum(i["code"] == "parse_error" for d in run["documents"] for i in d["issues"])}))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Intake failed; no public status update: {error}", file=sys.stderr)
        # A failure receipt complements successful per-document retrieval receipts.
        failure = {"status": "failed", "failedAt": datetime.now(timezone.utc).isoformat(), "error": str(error)}
        write_immutable(DEFAULT_STORE / "failures" / f"{digest(canonical(failure))}.json", canonical(failure))
        sys.exit(1)

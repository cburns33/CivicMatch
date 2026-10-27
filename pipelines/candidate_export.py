"""Read the SOS portal's filtered County Clerk export without importing contact fields."""
import re
import zipfile
import xml.etree.ElementTree as ET

MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
TITLE = "Texas SOS Travis County Clerk candidate export"
PORTAL = "https://goelect.txelections.civixapps.com/ivis-cbp-ui/candidate-information"
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def extract(path, source):
    with zipfile.ZipFile(path) as book:
        if sum(info.file_size for info in book.infolist()) > 20_000_000:
            raise ValueError("Candidate export exceeds the expanded-size limit")
        sheets = ET.fromstring(book.read("xl/workbook.xml")).find("m:sheets", NS)
        if len(sheets) != 1 or sheets[0].get("name") != "Qualified Candidates":
            raise ValueError("Unexpected candidate export worksheets")
        root = ET.fromstring(book.read("xl/worksheets/sheet1.xml"))
        if root.findall(".//m:f", NS):
            raise ValueError("Candidate export contains unexpected formulas")
        shared = []
        if "xl/sharedStrings.xml" in book.namelist():
            shared = ["".join(t.itertext()) for t in ET.fromstring(book.read("xl/sharedStrings.xml")).findall("m:si", NS)]
        rows = []
        for row in root.findall("m:sheetData/m:row", NS):
            cells = {}
            for cell in row:
                value = cell.find("m:v", NS)
                cells[re.sub(r"\d", "", cell.get("r"))] = shared[int(value.text)] if cell.get("t") == "s" else "".join(cell.itertext())
            rows.append((int(row.get("r")), cells))
    if len(rows) < 3 or rows[0][1].get("A") != "Election Year: 2026 -- Election Name: 2026 NOVEMBER GENERAL ELECTION -- Office Type: County  -- Office Name: COUNTY CLERK":
        raise ValueError("Candidate export election or office filter mismatch")
    if any(rows[1][1].get(col) != label for col, label in {"A": "Office Name", "C": "Candidate Name", "F": "Party", "L": "Status"}.items()):
        raise ValueError("Candidate export columns changed")
    candidates, preserved = [], []
    for number, row in rows[2:]:
        if row.get("A") != "TRAVIS - COUNTY CLERK" or not row.get("C") or not row.get("L"):
            raise ValueError("Candidate export row scope or status is missing")
        preserved.append({"row": number, "printedName": row["C"], "printedParty": row["F"], "status": row["L"]})
        if row["F"] == "WRITE-IN" and row["L"] == "Candidate in the General Election":
            candidates.append({"printedOffice": "County Clerk", "printedName": row["C"], "officeKey": "county clerk",
                               "sourceSha256": source["sha256"], "sourcePage": 1, "sourceSheet": "Qualified Candidates", "sourceRow": number,
                               "evidenceType": "official_candidate_portal_export", "officialStatus": row["L"], "reviewStatus": "needs_review"})
    if not candidates:
        raise ValueError("Export has no qualifying write-in row; do not silently remove prior evidence")
    return {"source": source, "pages": [{"page": 1, "unit": "worksheet", "sheet": "Qualified Candidates", "text": "", "rows": preserved,
                                          "status": "structured_export_pending_review"}], "records": [], "issues": [], "coverage": [],
            "writeIns": candidates, "cancellations": [], "formFields": {}}


def register(path, store):
    import json
    from datetime import datetime, timezone
    import ingest

    body = path.read_bytes()
    if len(body) > 20_000_000:
        raise ValueError("Candidate export exceeds the intake limit")
    sha = ingest.digest(body)
    relative = f"documents/{sha}.xlsx"
    ingest.write_immutable(store / relative, body)
    index_url = "https://www.sos.texas.gov/elections/laws/2026-november-general-election.shtml"
    index = ingest.archive(store, "travis", "discovery_page", "Texas SOS current candidate portal discovery", index_url, discovery_url=index_url)
    links = ingest.LinkParser()
    links.feed((store / index["archivePath"]).read_text(encoding="utf-8-sig"))
    if not any(url == PORTAL for _, url in links.links):
        raise ValueError("SOS index no longer links the candidate portal")
    source = {"county": "travis", "kind": "supporting_reference", "title": TITLE, "url": PORTAL,
              "discoveryUrl": index_url, "discoverySha256": index["sha256"], "sha256": sha, "bytes": len(body),
              "mediaType": MIME, "checksumScope": "document_bytes", "archivePath": relative,
              "retrievedAt": datetime.now(timezone.utc).isoformat(), "captureMethod": "official_portal_export_button", "sourceUnit": "worksheet",
              "exportFilters": {"year": "2026", "election": "2026 NOVEMBER GENERAL ELECTION", "officeType": "County", "county": "TRAVIS", "officeName": "COUNTY CLERK"}}
    result = extract(store / relative, source)
    ingest.write_immutable(store / "retrievals" / f"travis-clerk-export-{ingest.digest(ingest.canonical(source))}.json", ingest.canonical(source))
    browser_manifest = store / "browser-reference-manifest.json"
    references = json.loads(browser_manifest.read_text(encoding="utf-8")) if browser_manifest.exists() else []
    references = [s for s in references if s["title"] != TITLE] + [source]
    browser_manifest.write_bytes(ingest.canonical(references))
    manifest = store / "source-manifest.json"
    sources = json.loads(manifest.read_text(encoding="utf-8"))
    sources = [s for s in sources if s["title"] != TITLE] + [source]
    manifest.write_bytes(ingest.canonical(sources))
    return {"sourceSha256": sha, "qualifiedWriteInRows": len(result["writeIns"]), "reviewStatus": "needs_review"}


if __name__ == "__main__":
    import argparse
    import json
    from pathlib import Path
    import ingest
    parser = argparse.ArgumentParser(description="Register an unchanged workbook downloaded with the official portal Export results button.")
    parser.add_argument("workbook", type=Path)
    parser.add_argument("--store", type=Path, default=ingest.DEFAULT_STORE)
    args = parser.parse_args()
    print(json.dumps(register(args.workbook, args.store)))

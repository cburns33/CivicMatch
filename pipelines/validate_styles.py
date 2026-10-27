"""Compare an independent official style transcription with proposed staged membership.

No voter lookup, approval, address inference, or publication is performed.
"""
import argparse
import json
import re
from pathlib import Path
from urllib.parse import urlparse
from pypdf import PdfReader

from ingest import DEFAULT_STORE, canonical, digest


def printed(value):
    if isinstance(value, str):
        return " ".join(value.split())
    if isinstance(value, list):
        return [printed(v) for v in value]
    if isinstance(value, dict):
        return {k: printed(v) for k, v in value.items()}
    return value


def comparison_fields(record):
    fields = ["kind", "printedTitle", "voteInstruction", "writeInSlot"]
    if record["kind"] == "candidate_contest":
        return printed({**{k: record.get(k) for k in fields},
                        "candidates": [{k: c.get(k) for k in ["printedName", "partyCode", "ballotOrder"]} for c in record["candidates"]],
                        "declaredWriteIns": sorted(c["printedName"] for c in record["declaredWriteIns"])})
    if record["kind"] == "measure":
        fields += ["wordingByLanguage", "responseOptions", "electorateScope"]
    elif record["kind"] == "declaration":
        fields += ["declarationText"]
    else:
        raise ValueError("Unclassified record cannot be compared")
    return printed({k: record.get(k) for k in fields})


def compare(run, reference, proposed_ids, store):
    issues = []
    # A consolidated master cannot establish an individual ballot style.
    for key, expected in [("county", run["county"]), ("electionDate", run["electionDate"]),
                          ("runId", run["runId"]), ("sourceScope", "individual_style"), ("extractionComplete", True)]:
        if reference.get(key) != expected:
            issues.append(f"reference_{key}_mismatch")
    if not reference.get("styleCode") or not reference.get("language"):
        issues.append("missing_style_identity")
    url = urlparse(reference.get("sourceUrl", ""))
    hosts = {"travis": {"votetravis.gov", "tx.omniballot.us"}, "harris": {"www.harrisvotes.com", "files.harrisvotes.com", "hctxdnnstg.blob.core.windows.net"}}
    if url.scheme != "https" or url.hostname not in hosts[run["county"]]:
        issues.append("unrecognized_reference_authority")
    sha = reference.get("sourceSha256", "")
    relative = reference.get("archivePath", "")
    if not re.fullmatch(r"[a-f0-9]{64}", sha) or relative != f"documents/{sha}.pdf":
        issues.append("invalid_reference_archive")
    else:
        path = store / relative
        if not path.is_file() or digest(path.read_bytes()) != sha:
            issues.append("reference_checksum_mismatch")
        else:
            try:
                count = len(PdfReader(path).pages)
                if reference.get("sourcePages") != list(range(1, count + 1)):
                    issues.append("reference_page_count_mismatch")
            except Exception:
                issues.append("unreadable_reference_pdf")
        if any(d["source"]["sha256"] == sha for d in run["documents"]):
            issues.append("reference_is_import_source")
    expected = reference.get("records", [])
    ids = [r["recordId"] for r in expected]
    if not ids or len(set(ids)) != len(ids) or len(set(proposed_ids)) != len(proposed_ids):
        issues.append("empty_or_duplicate_membership")
    staged = {r["id"]: r for r in run["records"]}
    if set(ids) - set(proposed_ids):
        issues.append("missing_contests")
    if set(proposed_ids) - set(ids):
        issues.append("extra_contests")
    if set(ids) == set(proposed_ids) and ids != proposed_ids:
        issues.append("contest_order_mismatch")
    pages = reference.get("sourcePages", [])
    if not pages or pages != list(range(1, len(pages) + 1)):
        issues.append("reference_page_coverage_missing")
    for row in expected:
        key = row["recordId"]
        if row.get("sourcePage") not in pages:
            issues.append(f"missing_record_provenance:{key}")
        if key not in staged:
            issues.append(f"unknown_contest:{key}")
        elif comparison_fields(staged[key]) != printed(row["fields"]):
            issues.append(f"contest_content_mismatch:{key}")
    return {"county": run["county"], "runId": run["runId"], "styleCode": reference.get("styleCode"),
            "sourceSha256": sha, "referenceChecksum": digest(canonical(reference)),
            "membershipChecksum": digest(canonical(proposed_ids)), "issues": issues,
            "status": "blocked" if issues else "comparison_passed_pending_review",
            "eligibilityVerified": False, "publicationApproved": False}


def audit(store):
    reference_path = store / "style-references.json"
    references = json.loads(reference_path.read_text(encoding="utf-8")) if reference_path.exists() else []
    counties = []
    for county in ["travis", "harris"]:
        run = json.loads((store / "latest" / f"{county}.json").read_text(encoding="utf-8"))
        results = [compare(run, r["reference"], r["proposedRecordIds"], store) for r in references if r["reference"]["county"] == county]
        counties.append({"county": county, "runId": run["runId"], "referenceCount": len(results),
                         "comparisonPassedCount": sum(r["status"] == "comparison_passed_pending_review" for r in results),
                         "officiallyVerifiedCount": 0, "addressFixtureCount": 0, "status": "blocked", "results": results})
    return {"schemaVersion": 1, "electionDate": "2026-11-03", "counties": counties,
            "limitation": "Independent official style references and human review are required. No address eligibility is established."}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--store", type=Path, default=DEFAULT_STORE)
    args = parser.parse_args()
    report = audit(args.store)
    (args.store / "style-validation.json").write_bytes(canonical(report))
    public_report = {**report, "counties": [{k: v for k, v in c.items() if k != "results"} for c in report["counties"]]}
    if args.store.resolve() == DEFAULT_STORE.resolve():
        (DEFAULT_STORE.parents[1] / "src/data/official-style-status.json").write_bytes(canonical(public_report))
    print(json.dumps({"counties": [{k: v for k, v in c.items() if k != "results"} for c in report["counties"]]}))
    raise SystemExit(2 if any(c["status"] == "blocked" for c in report["counties"]) else 0)

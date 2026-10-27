"""Evidence-linked supplemental records and conservative, unapproved matches."""
from __future__ import annotations

import re


def office_key(value):
    value = value.casefold().replace("u.s.", "united states")
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return " ".join(value.split())


def scope_key(value):
    value = value.casefold().replace("&", "and")
    value = re.sub(r"^hc\b", "harris county", value)
    for phrase, short in [("independent school district", "isd"), ("municipal utility district", "mud"),
                           ("water control and improvement district", "wcid"), ("emergency services district", "esd"),
                           ("fresh water supply district", "fwsd")]:
        value = value.replace(phrase, short)
    value = re.sub(r"\b(?:no|number)\.?\s*(?=\d)", "", value)
    # The two documents call these same NHCRWA offices Position and District.
    if value.startswith("north harris county regional water authority"):
        value = value.replace("position", "district")
    return office_key(value)


def starts_scope(scope, value):
    return value == scope or value.startswith(scope + " ")


def has_election_date(text):
    return bool(re.search(r"November\s+3(?:rd)?\s*,?\s*2026", text, re.I))


def parse_write_ins(pdf, source):
    page = pdf.pages[0]
    county = source["county"]
    split = 350 if county == "travis" else 360
    header = next(l for l in page.extract_text_lines() if "Office Sought" in l["text"])
    start = header["bottom"] + 1
    if county == "harris":
        start = next(l["top"] for l in page.extract_text_lines() if l["text"].startswith("United States Senator")) - 1
    stop = 555 if county == "travis" else 610
    left = page.crop((35, start, split, stop)).extract_text_lines()
    right = page.crop((split, start, page.width-15, stop)).extract_text_lines()
    rows = []
    office = None
    for line in left:
        if county == "travis" or re.match(r"^(United States Senator|Governor$|Lieutenant Governor|Member, State Board|County Judge|County Commissioner)", line["text"]):
            office = line["text"]
        names = [name for name in right if abs(name["top"]-line["top"]) < 3]
        for name in names:
            if not office:
                raise ValueError("Write-in name has no office heading")
            rows.append({"printedOffice": office, "printedName": name["text"], "officeKey": office_key(office),
                         "sourceSha256": source["sha256"], "sourcePage": 1,
                         "sourceBounds": [35, line["top"], page.width-15, max(line["bottom"], name["bottom"])],
                         "evidenceType": "document_text", "reviewStatus": "needs_review"})
    if len(rows) != len(right) or not rows:
        raise ValueError("Write-in name rows were not fully assigned")
    return rows


def parse_cancellations(pdf, source, pages, form_fields=None):
    if source["county"] == "travis":
        original = "\n".join(p["text"] for p in pages)
        machine = "\n".join(p.get("ocrText", "") for p in pages)
        evidence = "document_text" if has_election_date(original) else "machine_transcription" if has_election_date(machine) else "index_only"
        if form_fields and [form_fields.get(key) for key in ["(date) (month)", "(date) (day)", "(date) (year)"]] == ["11", "03", "2026"]:
            evidence = "pdf_form_fields"
        type_supported = bool(re.search(r"cancel|unopposed|uncontested", original + "\n" + machine, re.I))
        return [{"printedScope": source["title"], "sourceSha256": source["sha256"],
                 "sourcePages": list(range(1, len(pages)+1)), "scopeEvidence": "official_index_link_title",
                 "dateEvidence": evidence, "cancellationLanguageFound": type_supported, "reviewStatus": "needs_review"}]
    notices = []
    if not has_election_date(pages[0]["text"]):
        raise ValueError("Harris cancellation notice election date mismatch")
    for number, page in enumerate(pdf.pages, 1):
        for line in page.extract_text_lines():
            if line["text"].startswith("NOTICE") or line["top"] < (240 if number == 1 else 0):
                continue
            if all("Bold" in c["fontname"] for c in line["chars"] if c["text"].strip()):
                notices.append({"printedScope": line["text"], "sourceSha256": source["sha256"], "sourcePages": [number],
                                "sourceBounds": [line["x0"], line["top"], line["x1"], line["bottom"]],
                                "scopeEvidence": "document_text", "dateEvidence": "document_text", "reviewStatus": "needs_review"})
    if not notices:
        raise ValueError("No cancellation scope rows found")
    return notices


def wording_key(value):
    return " ".join(re.findall(r"\w+", value.casefold()))


def resolve_reference_scopes(records, documents):
    """Add source-supported electorate labels without approving composition."""
    issues = []
    order = next((d for d in documents if d["source"]["kind"] == "supporting_reference" and d["source"]["title"] == "ESD 10 election order"), None)
    if order:
        text = order["pages"][0]["text"]
        headings = [("existing_district", "For registered voters in the District:"),
                    ("annexation_territory", "For the registered voters in the Edgewater and River Terrace Defined Territory to be annexed:")]
        expected = []
        if has_election_date(text) and all(heading in text for _, heading in headings):
            for index, (scope, heading) in enumerate(headings):
                body = text.split(heading, 1)[1].split(headings[index+1][1] if index == 0 else "Early voting by personal appearance", 1)[0]
                for letter, warning, wording in re.findall(r'PROPOSITION ([AB])\s+\(PROPOSICIÓN [AB]\)\s+(THIS IS A TAX INCREASE\s+)?[“"](.+?)(?=\s*\()', body, re.S):
                    expected.append((letter, bool(warning), wording_key(wording), scope))
        variants = [r for r in records if r["printedTitle"] in ["Travis County ESD No. 10 Proposition A", "Travis County ESD No. 10 Proposition B"]]
        matches = []
        for record in variants:
            wording = record["wordingByLanguage"]["en"]
            warning = wording.startswith("THIS IS A TAX INCREASE")
            body = re.sub(r"^THIS IS A TAX INCREASE\.?\s*", "", wording)
            matches.append([scope for letter, tax, exact, scope in expected if record["printedTitle"].endswith(letter) and tax == warning and exact == wording_key(body)])
        if len(expected) == 4 and len(variants) == 4 and all(len(match) == 1 for match in matches):
            for record, match in zip(variants, matches):
                record.update({"identityStatus": "scope_supported_pending_review", "electorateScope": match[0],
                               "scopeEvidence": {"sourceSha256": order["source"]["sha256"], "sourcePage": 1,
                                                 "basis": "official_order_exact_wording_and_warning", "reviewStatus": "needs_review"}})
            for document in documents:
                document["issues"] = [issue for issue in document["issues"] if not (issue["code"] == "ambiguous_scope" and "Travis County ESD No. 10 Proposition" in issue["message"])]
        elif variants:
            issues.append({"code": "reference_scope_mismatch", "message": "ESD 10 ballot wording does not match all four electorate-specific order clauses. Preserve the scope ambiguity."})
    order = next((d for d in documents if d["source"]["kind"] == "supporting_reference" and d["source"]["title"] == "Mustang Ridge election order"), None)
    if order:
        page = order["pages"][0]
        text = page["text"] + "\n" + page.get("ocrText", "")
        if has_election_date(text) and re.search(r"\(1\)\s*Mayor\s+and\s*\(2\)\s*Councilmembers", text, re.I):
            for document in documents:
                for notice in document.get("cancellations", []):
                    if notice["printedScope"] == "City of Mustang Ridge" and notice["cancellationLanguageFound"]:
                        original = "\n".join(p["text"] + "\n" + p.get("ocrText", "") for p in document["pages"])
                        if all(name in original for name in ["Michelle Bergmann", "Gabriel Vallejo", "Casondra Dailey"]):
                            notice.update({"dateEvidence": "cross_document_scope", "scopeEvidence": "county_index_and_matching_election_order",
                                           "supportingSourceSha256": order["source"]["sha256"], "supportingSourcePage": 1,
                                           "scopeLimitation": "The cancellation order omits the election date. November scope is corroborated by the county index and the official order for one mayor and two councilmembers.",
                                           "reviewStatus": "needs_review"})
    return issues


def reconcile(records, documents):
    write_ins, cancellations, issues = [], [], []
    for document in documents:
        for candidate in document.get("writeIns", []):
            matches = [r for r in records if r["kind"] == "candidate_contest" and office_key(r["printedTitle"]) == candidate["officeKey"]]
            status = "matched_slot" if len(matches) == 1 and matches[0]["writeInSlot"] else "outside_master_scope" if not matches else "slot_or_identity_conflict"
            item = {**candidate, "matchStatus": status, "matchedRecordIds": [r["id"] for r in matches]}
            write_ins.append(item)
            if status == "matched_slot":
                matches[0]["declaredWriteIns"].append(item)
            elif status == "slot_or_identity_conflict":
                issues.append({"code": "write_in_conflict", "message": f"Write-in certification requires slot/identity review for {candidate['printedOffice']}."})
        for notice in document.get("cancellations", []):
            scope = scope_key(notice["printedScope"])
            matches = [r for r in records if any(starts_scope(scope, scope_key(value)) for value in [r["sourceSection"], r["printedTitle"]])]
            active = [r for r in matches if r["kind"] == "candidate_contest"]
            declarations = [r for r in matches if r["kind"] == "declaration"]
            measures = [r for r in matches if r["kind"] == "measure"]
            status = "possible_active_conflict" if active else "corroborates_declaration" if declarations else "measure_only_scope" if measures else "no_matching_master_record"
            if notice["dateEvidence"] == "index_only" or notice.get("cancellationLanguageFound") is False:
                status = "scope_review_required"
            cancellations.append({**notice, "matchStatus": status, "matchedRecordIds": [r["id"] for r in matches],
                                  "effect": "review_only_no_records_removed"})
            if active:
                issues.append({"code": "cancellation_conflict", "message": f"Cancellation may overlap an active candidate contest: {notice['printedScope']}. Compare office and election scope."})
            if notice["dateEvidence"] == "index_only":
                issues.append({"code": "cancellation_date_unverified", "message": f"The November index lists {notice['printedScope']}; the document election date needs visual review."})
            if notice.get("cancellationLanguageFound") is False:
                issues.append({"code": "cancellation_document_type_unverified", "message": f"The cancellation index links {notice['printedScope']}, but extracted document text does not establish a cancellation. Inspect the linked order before applying an effect."})
    for record in records:
        if record["writeInSlot"] and not record["declaredWriteIns"]:
            issues.append({"code": "unnamed_write_in_slot", "message": f"No applicable named write-in certification located for {record['printedTitle']}. Preserve the printed slot; do not infer a name."})
    return {"writeIns": write_ins, "cancellations": cancellations, "issues": issues, "reviewStatus": "needs_review"}

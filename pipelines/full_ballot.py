"""County-specific layout extraction. All outputs remain unapproved staging."""
from __future__ import annotations

import hashlib
import re


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.casefold()).strip("-")


def horizontal(obj: dict) -> bool:
    return obj.get("object_type") != "char" or abs(obj.get("matrix", (1, 0))[1]) < .01


def text_lines(page, bounds, language="all", county="travis", body=False):
    def include(obj):
        if not horizontal(obj):
            return False
        if obj.get("object_type") == "char" and obj.get("size",0) > 16:
            return False  # Presentation heading overlaps the first Harris row.
        if obj.get("object_type") != "char" or language == "all":
            return True
        italic = "Italic" in obj.get("fontname", "")
        if county == "harris" and body:
            return obj["size"] > 11 if language == "en" else obj["size"] <= 11
        return not italic if language == "en" else italic
    return page.filter(include).crop(tuple(bounds)).extract_text_lines(x_tolerance=1, y_tolerance=3, return_chars=True)


def text(page, bounds, language="all", county="travis", body=False):
    return "\n".join(line["text"] for line in text_lines(page, bounds, language, county, body))


def bold(line):
    chars = [c for c in line["chars"] if c["text"].strip()]
    return bool(chars) and sum("Bold" in c["fontname"] for c in chars) / len(chars) > .8


def instruction_continuation(value):
    return bool(re.fullmatch(r"(?:none|one|two|three|four|five|six|seven|eight|nine|ten|or|and|,|\s)+", value, re.I))


def unique_rectangles(rects):
    result = []
    for rect in sorted(rects, key=lambda r: (r["top"], -(r["bottom"]-r["top"]))):
        if not any(abs(rect["top"]-other["top"]) < 2 and abs(rect["bottom"]-other["bottom"]) < 2 for other in result):
            result.append(rect)
    return result


def markers(page, left, right, county):
    found = []
    for rect in page.rects:
        if not (150 < rect["width"] < 185 and rect["x0"] >= left-1 and rect["x1"] <= right+1 and 105 <= rect["top"] < 1155):
            continue
        color = rect.get("non_stroking_color")
        if county == "travis" and isinstance(color, (int, float)) and abs(color-.753) < .01:
            found.append({**rect, "markerKind": "section"})
        if county == "harris" and isinstance(color, (tuple, list)) and len(color) == 3:
            if all(abs(c-.863) < .01 for c in color):
                found.append({**rect, "markerKind": "contest"})
            elif all(abs(c-.2) < .01 for c in color):
                found.append({**rect, "markerKind": "section"})
    found = unique_rectangles(found)
    # Harris draws nested rectangles for English/Spanish section captions.
    return [r for r in found if not any(o is not r and o["markerKind"] == "section" and o["top"] <= r["top"] and o["bottom"] >= r["bottom"] and o["bottom"]-o["top"] > r["bottom"]-r["top"]+2 for o in found)]


def choices(page, bounds, county):
    left, top, right, bottom = bounds
    shapes = page.curves if county == "travis" else page.rects
    found = []
    for shape in shapes:
        w, h = shape["width"], shape["height"]
        valid = (10 <= w <= 20 and 3 <= h <= 12) if county == "travis" else (18 <= w <= 28 and 6 <= h <= 14)
        if valid and left-4 <= shape["x0"] < left+35 and top <= shape["top"] < bottom:
            if not any(abs(s["top"]-shape["top"]) < 2 for s in found):
                found.append(shape)
    return sorted(found, key=lambda s: s["top"])


def record_base(county, source, title, section, page, column, bounds, raw):
    key = slug(title)
    if not title.startswith("United States"):
        key += "-" + hashlib.sha256(section.encode()).hexdigest()[:10]
    return {"id": f"{county}-{key}", "printedTitle": title, "sourceSection": section,
            "kind": "measure" if "proposition" in title.casefold() else "candidate_contest",
            "candidates": [], "declaredWriteIns": [], "writeInSlot": False,
            "sourceRecordKey": key, "sourceSha256": source["sha256"], "sourcePage": page,
            "sourceColumn": column, "sourceBounds": bounds,
            "sourceSpans": [{"page": page, "column": column, "bounds": bounds}],
            "rawText": raw, "reviewStatus": "needs_review"}


def parse_choices(page, bounds, county, record):
    symbols = choices(page, bounds, county)
    english = text_lines(page, bounds, "en", county)
    for i, symbol in enumerate(symbols):
        start = symbol["top"]-8
        end = symbols[i+1]["top"]-8 if i+1 < len(symbols) else bounds[3]
        lines = [line for line in english if line["top"] >= start and line["top"] < end]
        if county == "harris" and record["kind"] == "candidate_contest":
            name = " ".join(line["text"] for line in lines if bold(line))
        else:
            name = " ".join(line["text"] for line in lines)
        if record["kind"] == "measure":
            # Choice labels share a row with an italic Spanish label.
            nearby = [l["text"] for l in english if abs((l["top"]+l["bottom"])/2-(symbol["top"]+symbol["bottom"])/2) < 10]
            record.setdefault("responseOptions", []).append(" ".join(nearby).strip(" /"))
            continue
        all_text = " ".join(line["text"] for line in lines)
        if re.search(r"W\s*rite[ -]in", all_text, re.I):
            record["writeInSlot"] = True
            continue
        match = re.search(r"\s*\((REP|DEM|LIB|GRN)\)$", name)
        party = match.group(1) if match else None
        if match:
            name = name[:match.start()].strip()
        for label, code in {"Republican Party": "REP", "Democratic Party": "DEM", "Libertarian Party": "LIB", "Green Party": "GRN"}.items():
            if label in all_text:
                party = code
        record["candidates"].append({"printedName": name, "normalizedName": " ".join(name.casefold().split()),
                                      "printedParty": f"({party})" if party and county == "travis" else next((label for label in ["Republican Party", "Democratic Party", "Libertarian Party", "Green Party"] if label in all_text), None),
                                      "partyCode": party, "ballotOrder": len(record["candidates"])+1})
    return symbols


def parse_record(page, county, source, title, section, number, column, bounds, body_top):
    record = record_base(county, source, title, section, number, column, bounds, text(page, bounds))
    body_bounds = [bounds[0], body_top, bounds[2], bounds[3]]
    symbols = parse_choices(page, body_bounds, county, record)
    en = text_lines(page, body_bounds, "en", county)
    instruction = []
    for line in en:
        if line["text"].startswith("Vote for") or instruction and instruction_continuation(line["text"]):
            instruction.append(line["text"])
        elif instruction:
            break
    record["voteInstruction"] = " ".join(instruction) or None
    if record["kind"] == "measure":
        wording_bottom = symbols[0]["top"]-8 if symbols else bounds[3]
        wording_bounds = [bounds[0], body_top, bounds[2], max(body_top, wording_bottom)]
        record["wordingByLanguage"] = {}
        for language in ["en", "es"]:
            lines = text_lines(page, wording_bounds, language, county, body=county == "harris")
            if county == "travis" and language == "es":
                lines = [l for l in lines if not bold(l)]
            record["wordingByLanguage"][language] = "\n".join(l["text"] for l in lines)
    return record, len(symbols)


def extract_master(pdf, county, source):
    records, issues, coverage = [], [], []
    section = ""
    columns = [(14,198),(207,391),(400,584),(592,776)] if county == "travis" else [(46,218),(221,393),(396,568),(571,744)]
    for number, page in enumerate(pdf.pages, 1):
        for column, (left, right) in enumerate(columns, 1):
            top = 108 if county == "travis" else 138
            bounds = [left, top, right, 1155]
            events = markers(page, left, right, county)
            total_choices = len(choices(page, bounds, county))
            assigned_choices = 0
            before_count = len(records)
            for index, event in enumerate(events):
                end = events[index+1]["top"] if index+1 < len(events) else 1155
                event_bounds = [left, event["top"], right, end]
                header_bounds = [left, event["top"], right, event["bottom"]]
                caption_lines = text_lines(page, header_bounds, "en", county)
                if county == "harris" and event["markerKind"] == "section":
                    caption_lines = [l for l in caption_lines if any(c["size"] >= 10.5 for c in l["chars"])]
                caption = " ".join(l["text"] for l in caption_lines)
                if event["markerKind"] == "section":
                    section = caption
                    if "Party Legend" in section:
                        continue
                    content_bounds = [left, event["bottom"]+.1, right, end]
                    if county == "harris":
                        if "Declared Elected" in caption or "Unopposed" in caption:
                            record = record_base(county, source, caption, caption, number, column, event_bounds, text(page,event_bounds))
                            record["kind"] = "declaration"
                            record["declarationText"] = text(page,event_bounds)
                            records.append(record)
                        continue
                    en = text_lines(page, content_bounds, "en", county)
                    headings = []
                    for line in en:
                        if bold(line) and not line["text"].startswith("Vote for") and not instruction_continuation(line["text"]):
                            if headings and line["top"]-headings[-1]["bottom"] <= 12:
                                headings[-1]["title"] += " " + line["text"]
                                headings[-1]["bottom"] = line["bottom"]
                            else:
                                headings.append({"title": line["text"], "top": line["top"], "bottom": line["bottom"]})
                    if not headings and en:
                        if choices(page,content_bounds,county):
                            record,count=parse_record(page,county,source,caption,section,number,column,event_bounds,event["bottom"]+.1)
                            assigned_choices += count
                        else:
                            record = record_base(county, source, caption, caption, number, column,event_bounds,text(page,event_bounds))
                            record["kind"] = "declaration" if "Declared Elected" in caption else "unclassified"
                            record["declarationText"] = text(page,content_bounds)
                        records.append(record)
                    for h, heading in enumerate(headings):
                        bottom = headings[h+1]["top"] if h+1 < len(headings) else end
                        rec_bounds = [left,heading["top"],right,bottom]
                        record, count = parse_record(page,county,source,heading["title"],section,number,column,rec_bounds,heading["bottom"]+.1)
                        records.append(record)
                        assigned_choices += count
                else:
                    record, count = parse_record(page,county,source,caption,section,number,column,event_bounds,event["bottom"]+.1)
                    records.append(record)
                    assigned_choices += count
            if total_choices != assigned_choices:
                issues.append({"code":"unassigned_choices","page":number,"column":column,"message":f"{total_choices-assigned_choices} ballot choices require source-region reconciliation."})
            coverage.append({"page":number,"column":column,"sourceBounds":bounds,"markerCount":len(events),"choiceCount":total_choices,"assignedChoiceCount":assigned_choices,"recordCount":len(records)-before_count})
    grouped = {}
    for record in records:
        grouped.setdefault(record["id"], []).append(record)
    for key, variants in grouped.items():
        if len(variants) > 1:
            for record in variants:
                variant = hashlib.sha256(record["rawText"].encode()).hexdigest()[:10]
                record["id"] = f"{key}-variant-{variant}"
                record["sourceRecordKey"] += f"-variant-{variant}"
                record["identityStatus"] = "ambiguous_scope"
            issues.append({"code":"ambiguous_scope","message":f"Repeated caption preserved as separate source variants: {variants[0]['printedTitle']}. Official electorate/style scope needs review."})
    for record in records:
        if record["kind"] == "candidate_contest" and (not record["candidates"] or any(not c["printedName"] for c in record["candidates"])):
            issues.append({"code":"candidate_parse_incomplete","recordId":record["id"],"message":"Candidate contest has missing or empty candidate labels."})
        if record["kind"] == "measure" and (len(record.get("responseOptions",[])) < 2 or not record["wordingByLanguage"]["en"]):
            issues.append({"code":"measure_parse_incomplete","recordId":record["id"],"message":"Measure text or response options require source-region reconciliation."})
        if record["kind"] == "unclassified":
            issues.append({"code":"unclassified_region","recordId":record["id"],"message":"Preserved source region requires classification."})
    return records, issues, coverage

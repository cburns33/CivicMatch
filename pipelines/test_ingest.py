import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import ingest
import full_ballot
import supplements


class IntakeTests(unittest.TestCase):
    def test_discovery_requires_election_scoped_master_and_harris_supplements(self):
        with self.assertRaises(ValueError):
            ingest.discover("harris", '<a href="/old.pdf">2025 Sample Ballot</a>')
        html = '<a href="/master.pdf">November 3rd 2026 Sample Ballot</a><a href="/writes.pdf">Write-In Candidates</a><a href="/cancel.pdf">Notice of Cancellations</a>'
        self.assertEqual(set(ingest.discover("harris", html)), {"master_ballot", "write_ins", "cancellations"})

    def test_ambiguous_discovery_links_require_review(self):
        html = '<a href="/a.pdf">2026 Consolidated Ballot</a><a href="/b.pdf">2026 Consolidated Ballot</a>'
        with self.assertRaises(ValueError):
            ingest.discover("travis", html)

    def test_travis_preserves_unicode_printed_case_and_separate_write_in_slot(self):
        records = ingest.federal_sections(["United States Representative,", "District 99", "Example Peña (DEM)", "Example Two (REP)", "W rite-in /", "State Offices", "Governor"], "travis")
        self.assertEqual(records[0]["printedTitle"], "United States Representative, District 99")
        self.assertEqual(records[0]["candidates"][0]["printedName"], "Example Peña")
        self.assertEqual(records[0]["candidates"][0]["normalizedName"], "example peña")
        self.assertTrue(records[0]["writeInSlot"])
        self.assertEqual(len(records[0]["candidates"]), 2)

    def test_harris_joins_wrapped_candidate_names_without_altering_case(self):
        records = ingest.federal_sections(["United States Representative, District", "99", "Vote for none or one", "EXAMPLE GIVEN", "FAMILY NAME", "Democratic Party", "EXAMPLE TWO", "Green Party"], "harris")
        self.assertEqual(records[0]["candidates"][0]["printedName"], "EXAMPLE GIVEN FAMILY NAME")
        self.assertEqual(records[0]["candidates"][1]["printedParty"], "Green Party")

    def test_unrecognized_or_incomplete_candidate_cannot_disappear(self):
        for county, lines in [("travis", ["United States Senator", "Unrecognized candidate"]), ("harris", ["United States Senator", "EXAMPLE WITHOUT PARTY"]), ("harris", ["United States Senator", "Republican Party"])]:
            with self.subTest(county=county, lines=lines), self.assertRaises(ValueError):
                ingest.federal_sections(lines, county)

    def test_diff_preserves_removed_and_changed_records_for_review(self):
        before = [{"id": "one", "printedTitle": "Old"}, {"id": "two", "printedTitle": "Remove"}]
        after = [{"id": "one", "printedTitle": "New"}, {"id": "three", "printedTitle": "Add"}]
        changes = ingest.import_diff(before, after)
        self.assertEqual({c["change"] for c in changes}, {"added", "changed", "removed"})
        self.assertTrue(all(c["reviewRequired"] for c in changes))
        self.assertEqual(ingest.import_diff(after, after), [])

    def test_duplicate_identity_cannot_be_diffed(self):
        with self.assertRaises(ValueError):
            ingest.import_diff([], [{"id": "same"}, {"id": "same"}])

    def test_immutable_archive_rejects_changed_bytes(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "archive.pdf"
            ingest.write_immutable(path, b"first")
            ingest.write_immutable(path, b"first")
            with self.assertRaises(ValueError):
                ingest.write_immutable(path, b"changed")

    def test_repeated_import_reuses_run_and_checks_archive_before_reuse(self):
        with tempfile.TemporaryDirectory() as temp:
            store = Path(temp)
            content = b"%PDF-test fixture"
            sha = ingest.digest(content)
            source = {"county": "travis", "kind": "master_ballot", "sha256": sha, "archivePath": f"documents/{sha}.pdf"}
            ingest.write_immutable(store / source["archivePath"], content)
            sources = [{**source, "kind": kind} for kind in ["master_ballot", "write_ins", "cancellations"]]
            record = {"id": "test", "kind": "candidate_contest", "printedTitle": "Example", "sourceSection": "Example", "writeInSlot": False, "declaredWriteIns": []}
            def document(_, item):
                return {"source": item, "pages": [{"page": 1, "text": "test"}], "records": [record] if item["kind"] == "master_ballot" else [], "issues": []}
            with patch("ingest.extract_document", side_effect=document) as extract:
                first = ingest.stage(store, "travis", sources)
                second = ingest.stage(store, "travis", list(reversed(sources)))
                self.assertEqual(first, second)
                self.assertEqual(extract.call_count, 3)
                self.assertEqual(len(list((store / "runs").glob("*.json"))), 1)
            (store / source["archivePath"]).write_bytes(b"tampered")
            with self.assertRaisesRegex(ValueError, "checksum mismatch"):
                ingest.stage(store, "travis", sources)

    def test_wrapped_vote_instruction_is_not_a_contest_heading(self):
        self.assertTrue(full_ballot.instruction_continuation("four or five"))
        self.assertFalse(full_ballot.instruction_continuation("City Council Place Five"))

    def test_only_november_cancellation_index_section_is_discovered(self):
        parser = ingest.NoticeParser()
        parser.feed('<h3>November 3, 2026 Elections</h3><h4>Orders of Election</h4><a href="/order.pdf">Other</a><h4>Notices of Cancelled Elections</h4><a href="/cancel.pdf">District</a><h3>May 2, 2026 Elections</h3><a href="/may.pdf">Old</a>')
        self.assertEqual([r["title"] for r in parser.notices], ["District"])

    def test_inventory_cannot_silently_omit_a_linked_cancellation(self):
        with tempfile.TemporaryDirectory() as temp:
            store = Path(temp)
            content = b'<h3>November 3, 2026 Elections</h3><h4>Notices of Cancelled Elections</h4><a href="/cancel.pdf">District</a>'
            sha = ingest.digest(content)
            source = {"county": "travis", "kind": "discovery_page", "url": "https://votetravis.gov/resources/required-notices/", "sha256": sha, "archivePath": f"documents/{sha}.html"}
            ingest.write_immutable(store / source["archivePath"], content)
            with self.assertRaisesRegex(ValueError, "inventory differs"):
                ingest.validate_cancellation_inventory(store, [source])
            notice = {"county": "travis", "kind": "cancellations", "title": "District", "discoverySha256": sha}
            ingest.validate_cancellation_inventory(store, [source, notice])

    def test_office_matching_preserves_district_numbers(self):
        self.assertEqual(supplements.office_key("U.S. Representative, District 27"), supplements.office_key("United States Representative, District 27"))
        self.assertNotEqual(supplements.scope_key("HC MUD No. 1"), supplements.scope_key("Harris County Municipal Utility District No. 15"))
        self.assertFalse(supplements.starts_scope("harris county mud 1", "harris county mud 15 election"))

    def test_write_in_requires_unique_office_and_printed_slot(self):
        record = {"id": "one", "kind": "candidate_contest", "printedTitle": "Governor", "sourceSection": "State Offices", "writeInSlot": True, "declaredWriteIns": []}
        candidate = {"printedOffice": "Governor", "printedName": "Example", "officeKey": "governor"}
        result = supplements.reconcile([record], [{"writeIns": [candidate]}])
        self.assertEqual(result["writeIns"][0]["matchStatus"], "matched_slot")
        self.assertEqual(record["declaredWriteIns"][0]["printedName"], "Example")
        record["writeInSlot"] = False
        result = supplements.reconcile([record], [{"writeIns": [candidate]}])
        self.assertEqual(result["writeIns"][0]["matchStatus"], "slot_or_identity_conflict")
        record["writeInSlot"] = True
        result = supplements.reconcile([record, {**record, "id": "two"}], [{"writeIns": [candidate]}])
        self.assertEqual(result["writeIns"][0]["matchStatus"], "slot_or_identity_conflict")

    def test_cancellation_preserves_active_contest_and_distinguishes_propositions(self):
        records = [{"id": kind, "kind": kind, "printedTitle": "Example", "sourceSection": "Example ISD Bond Election", "writeInSlot": False} for kind in ["candidate_contest", "measure", "declaration"]]
        notice = {"printedScope": "Example Independent School District", "dateEvidence": "document_text"}
        result = supplements.reconcile(records, [{"cancellations": [notice]}])
        self.assertEqual(len(records), 3)
        self.assertEqual(result["cancellations"][0]["matchStatus"], "possible_active_conflict")
        self.assertEqual(result["cancellations"][0]["effect"], "review_only_no_records_removed")
        result = supplements.reconcile(records[1:], [{"cancellations": [notice]}])
        self.assertEqual(result["cancellations"][0]["matchStatus"], "corroborates_declaration")
        result = supplements.reconcile(records[1:2], [{"cancellations": [notice]}])
        self.assertEqual(result["cancellations"][0]["matchStatus"], "measure_only_scope")

    def test_wrong_document_type_and_unverified_date_block_cancellation_match(self):
        record = {"id": "one", "kind": "declaration", "printedTitle": "Example ISD", "sourceSection": "Example ISD", "writeInSlot": False}
        for fields in [{"dateEvidence": "index_only"}, {"dateEvidence": "pdf_form_fields", "cancellationLanguageFound": False}]:
            result = supplements.reconcile([record], [{"cancellations": [{"printedScope": "Example ISD", **fields}]}])
            self.assertEqual(result["cancellations"][0]["matchStatus"], "scope_review_required")

    def test_electorate_scope_requires_all_four_exact_wording_and_warning_matches(self):
        heading1 = "For registered voters in the District:"
        heading2 = "For the registered voters in the Edgewater and River Terrace Defined Territory to be annexed:"
        clause = lambda letter, warning: f'PROPOSITION {letter}\n(PROPOSICIÓN {letter})\n' + ('THIS IS A TAX INCREASE\n' if warning else '') + f'“Printed wording {letter}. (Texto)”\n'
        text = "November 3, 2026\n" + heading1 + "\n" + clause("A",False) + clause("B",False) + heading2 + "\n" + clause("A",True) + clause("B",True)
        document = {"source": {"kind":"supporting_reference","title":"ESD 10 election order","sha256":"a"*64}, "pages":[{"text":text}],"issues":[]}
        records = [{"printedTitle":f"Travis County ESD No. 10 Proposition {letter}","wordingByLanguage":{"en":('THIS IS A TAX INCREASE. ' if warning else '')+f'Printed wording {letter}.'},"identityStatus":"ambiguous_scope"} for warning in [False,True] for letter in ["A","B"]]
        self.assertEqual(supplements.resolve_reference_scopes(records,[document]),[])
        self.assertEqual([r["electorateScope"] for r in records],["existing_district","existing_district","annexation_territory","annexation_territory"])
        for record in records: record.pop("electorateScope")
        records[0]["wordingByLanguage"]["en"] = "Different wording."
        self.assertEqual(supplements.resolve_reference_scopes(records,[document])[0]["code"],"reference_scope_mismatch")
        self.assertFalse(any("electorateScope" in r for r in records))

    @unittest.skipUnless((ingest.DEFAULT_STORE / "latest" / "travis.json").exists(), "Local approved source archive is absent")
    def test_archived_county_references_preserve_known_edge_cases(self):
        runs = {county: json.loads((ingest.DEFAULT_STORE / "latest" / f"{county}.json").read_text(encoding="utf-8")) for county in ["travis", "harris"]}
        for county, run in runs.items():
            self.assertEqual(run["status"], "needs_review")
            self.assertEqual(run["parseScope"], "all_master_pages_and_supplements")
            self.assertEqual(len({r["id"] for r in run["records"]}), len(run["records"]))
            self.assertTrue(all(c["choiceCount"] == c["assignedChoiceCount"] for d in run["documents"] for c in d["coverage"]))
            self.assertTrue(all(r["wordingByLanguage"]["en"] and r["wordingByLanguage"]["es"] and len(r["responseOptions"]) == 2 for r in run["records"] if r["kind"] == "measure"))
        travis = runs["travis"]["records"]
        self.assertFalse(any(r["printedTitle"] == "four or five" for r in travis))
        eastwood = next(r for r in travis if r["printedTitle"] == "Eastwood MUD Permanent Directors")
        self.assertEqual(eastwood["voteInstruction"], "Vote for none, one, two, three, four or five")
        variants = [r for r in travis if r["printedTitle"] == "Travis County ESD No. 10 Proposition A"]
        self.assertEqual(len(variants), 2)
        self.assertEqual(sum("THIS IS A TAX INCREASE" in r["wordingByLanguage"]["en"] for r in variants), 1)
        self.assertTrue(all(r["identityStatus"] == "scope_supported_pending_review" for r in variants))
        self.assertEqual({r["electorateScope"] for r in variants}, {"existing_district", "annexation_territory"})
        self.assertEqual(sum(w["matchStatus"] == "matched_slot" for w in runs["travis"]["reconciliation"]["writeIns"]), 11)
        self.assertEqual(sum(w["matchStatus"] == "matched_slot" for w in runs["harris"]["reconciliation"]["writeIns"]), 14)
        self.assertEqual(len(runs["travis"]["reconciliation"]["cancellations"]), 51)
        self.assertEqual(len(runs["harris"]["reconciliation"]["cancellations"]), 31)
        mustang = next(n for n in runs["travis"]["reconciliation"]["cancellations"] if n["printedScope"] == "City of Mustang Ridge")
        self.assertEqual(mustang["dateEvidence"], "cross_document_scope")
        self.assertIn("omits the election date", mustang["scopeLimitation"])

    def test_missing_required_source_and_path_traversal_are_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaises(ValueError):
                ingest.stage(Path(temp), "harris", [])
            with self.assertRaises(ValueError):
                ingest.stage(Path(temp), "travis", [{"county": "travis", "kind": "master_ballot", "sha256": "a" * 64, "archivePath": "../secret.pdf"}])


if __name__ == "__main__":
    unittest.main()

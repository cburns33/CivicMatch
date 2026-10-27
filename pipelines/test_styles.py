import copy
import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock
from pypdf import PdfWriter

import candidate_export
from ingest import digest
from validate_styles import compare, comparison_fields


class StyleComparisonTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.store = Path(self.temp.name)
        book = PdfWriter()
        book.add_blank_page(width=600, height=800)
        data = io.BytesIO()
        book.write(data)
        sha = digest(data.getvalue())
        path = self.store / "documents" / f"{sha}.pdf"
        path.parent.mkdir()
        path.write_bytes(data.getvalue())
        self.records = [{"id": "race", "kind": "candidate_contest", "printedTitle": "TEST Council", "voteInstruction": "Vote for two",
                         "writeInSlot": True, "candidates": [{"printedName": "TEST Alpha", "partyCode": None, "ballotOrder": 1},
                         {"printedName": "TEST Beta", "partyCode": None, "ballotOrder": 2}], "declaredWriteIns": [{"printedName": "TEST Gamma"}]},
                        {"id": "measure", "kind": "measure", "printedTitle": "TEST Proposition A", "voteInstruction": None, "writeInSlot": False,
                         "wordingByLanguage": {"en": "THIS IS A TAX INCREASE. Issue $10,000?", "es": "TEST Spanish text"},
                         "responseOptions": ["For", "Against"], "electorateScope": "annexation_territory"}]
        self.run = {"county": "travis", "electionDate": "2026-11-03", "runId": "a" * 64, "records": self.records,
                    "documents": [{"source": {"sha256": "b" * 64}}]}
        self.ref = {"county": "travis", "electionDate": "2026-11-03", "runId": "a" * 64, "sourceScope": "individual_style",
                    "styleCode": "TEST-ONLY", "language": "en-es", "extractionComplete": True,
                    "sourceSha256": sha, "archivePath": f"documents/{sha}.pdf", "sourcePages": [1],
                    "sourceUrl": "https://votetravis.gov/test-only.pdf",
                    "records": [{"recordId": r["id"], "sourcePage": 1, "fields": comparison_fields(r)} for r in self.records]}

    def check(self, proposed=None):
        return compare(self.run, self.ref, proposed if proposed is not None else ["race", "measure"], self.store)

    def test_equal_transcription_never_grants_approval_or_address_eligibility(self):
        result = self.check()
        self.assertEqual(result["status"], "comparison_passed_pending_review")
        self.assertFalse(result["publicationApproved"])
        self.assertFalse(result["eligibilityVerified"])

    def test_membership_and_order_errors(self):
        for proposed, code in [(["race"], "missing_contests"), (["race", "measure", "extra"], "extra_contests"),
                               (["measure", "race"], "contest_order_mismatch"), (["race", "race", "measure"], "empty_or_duplicate_membership")]:
            with self.subTest(code=code):
                self.assertIn(code, self.check(proposed)["issues"])

    def test_wrong_election_county_run_master_and_partial_transcriptions(self):
        original = copy.deepcopy(self.ref)
        for key, value in [("electionDate", "2026-03-03"), ("county", "harris"), ("runId", "c" * 64),
                           ("sourceScope", "county_consolidated"), ("extractionComplete", False),
                           ("sourcePages", [1, 2]), ("sourceUrl", "https://example.com/ballot.pdf")]:
            with self.subTest(key=key):
                self.ref = {**original, key: value}
                self.assertEqual(self.check()["status"], "blocked")

    def test_candidate_order_writeins_vote_limit_and_measure_text_variants(self):
        original = copy.deepcopy(self.records)
        changes = [lambda r: r[0]["candidates"].reverse(), lambda r: r[0].update(writeInSlot=False),
                   lambda r: r[0].update(declaredWriteIns=[]), lambda r: r[0].update(voteInstruction="Vote for one"),
                   lambda r: r[1]["wordingByLanguage"].update(en="Issue $100,000?"),
                   lambda r: r[1]["wordingByLanguage"].update(es="Different Spanish text"),
                   lambda r: r[1]["responseOptions"].reverse(), lambda r: r[1].update(electorateScope="existing_district")]
        for change in changes:
            self.run["records"] = copy.deepcopy(original)
            change(self.run["records"])
            self.assertEqual(self.check()["status"], "blocked")

    def test_tampered_reference_and_missing_provenance(self):
        self.ref["records"][0]["sourcePage"] = 2
        self.assertIn("missing_record_provenance:race", self.check()["issues"])
        (self.store / self.ref["archivePath"]).write_bytes(b"tampered")
        self.assertIn("reference_checksum_mismatch", self.check()["issues"])


class CandidateExportTests(unittest.TestCase):
    def export(self, party="WRITE-IN", status="Candidate in the General Election", election="2026"):
        def row(number, cells):
            return '<row r="%s">%s</row>' % (number, ''.join(f'<c r="{col}{number}" t="inlineStr"><is><t>{value}</t></is></c>' for col, value in cells.items()))
        title = f"Election Year: {election} -- Election Name: 2026 NOVEMBER GENERAL ELECTION -- Office Type: County  -- Office Name: COUNTY CLERK"
        xml = '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + row(1, {"A": title}) + row(3, {"A": "Office Name", "C": "Candidate Name", "F": "Party", "L": "Status"}) + row(4, {"A": "TRAVIS - COUNTY CLERK", "C": "TEST Name", "F": party, "L": status, "G": "CONTACT FIELD MUST STAY OUT"}) + '</sheetData></worksheet>'
        files = {"xl/workbook.xml": '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets><sheet name="Qualified Candidates"/></sheets></workbook>', "xl/worksheets/sheet1.xml": xml}
        fake = MagicMock()
        fake.__enter__.return_value = fake
        fake.namelist.return_value = list(files)
        fake.read.side_effect = lambda name: files[name].encode()
        with patch("candidate_export.zipfile.ZipFile", return_value=fake):
            return candidate_export.extract(Path("unused"), {"sha256": "a" * 64})

    def test_extracts_only_official_qualified_writein_with_row_provenance(self):
        result = self.export()
        self.assertEqual(result["writeIns"][0]["sourceRow"], 4)
        self.assertEqual(result["writeIns"][0]["printedName"], "TEST Name")
        self.assertNotIn("CONTACT FIELD", str(result))

    def test_rejected_status_or_changed_filter_cannot_qualify(self):
        for args in [{"status": "Rejected"}, {"party": "DEMOCRATIC"}, {"election": "2025"}]:
            with self.assertRaises(ValueError):
                self.export(**args)


if __name__ == "__main__":
    unittest.main()

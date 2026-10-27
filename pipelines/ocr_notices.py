"""Transcribe image-only cancellation pages with Windows OCR for human review."""
import hashlib
import json
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
STORE = ROOT / "data" / "official"


def transcribe(source):
    path = STORE / source["archivePath"]
    if hashlib.sha256(path.read_bytes()).hexdigest() != source["sha256"]:
        raise ValueError("Source checksum mismatch before OCR")
    target = STORE / "ocr" / f"{source['sha256']}.json"
    if target.exists():
        return
    pages = []
    with pdfplumber.open(path) as pdf:
        for number, page in enumerate(pdf.pages, 1):
            if source["kind"] == "supporting_reference" and number > 1:
                continue
            if len((page.extract_text() or "").strip()) >= 80:
                continue
            image = ROOT / "output" / "ingestion" / f"{source['sha256']}-{number}.png"
            image.parent.mkdir(parents=True, exist_ok=True)
            page.to_image(resolution=160).save(image)
            result = subprocess.run(["powershell.exe", "-NoProfile", "-File", str(ROOT / "pipelines" / "ocr_windows.ps1"),
                                     "-ImagePath", str(image)], capture_output=True, encoding="utf-8", check=True)
            pages.append({"page": number, "text": result.stdout.strip(), "reviewStatus": "unverified_machine_transcription"})
    if pages:
        target.parent.mkdir(parents=True, exist_ok=True)
        payload = {"sourceSha256": source["sha256"], "engine": "Windows.Media.Ocr", "language": "en-US", "renderDpi": 160, "pages": pages}
        with target.open("x", encoding="utf-8") as output:
            json.dump(payload, output, ensure_ascii=False, sort_keys=True)
        print(f"OCR staged: {source['title']}, {len(pages)} pages", flush=True)


if __name__ == "__main__":
    sources = json.loads((STORE / "source-manifest.json").read_text(encoding="utf-8"))
    with ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(transcribe, [s for s in sources if s["kind"] in ["cancellations", "supporting_reference"]]))

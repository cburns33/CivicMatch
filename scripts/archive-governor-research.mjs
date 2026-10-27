import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

// Source bytes stay in the ignored archive. Receipts contain public provenance only.
const sources = [
  ["abbott-policy", "Abbott campaign policy", "https://www.gregabbott.com/policy/", null],
  ["abbott-vouchers", "Governor's SB 2 signing record", "https://gov.texas.gov/news/post/governor-abbott-signs-landmark-school-choice-legislation-into-law", "2025-05-03"],
  ["hinojosa-schools", "Hinojosa school policy", "https://ginafortexas.com/priority/save-texas-public-schools/", null],
  ["hinojosa-economy", "Hinojosa economic policy", "https://ginafortexas.com/priority/an-affordable-texas-that-works-for-everyone/", null],
  ["hinojosa-abortion", "Hinojosa reproductive policy statement", "https://ginafortexas.com/2026/01/on-anniversary-of-roe-v-wade-gina-hinojosa-shares-her-story-and-commitment-to-restore-reproductive-freedom/", "2026-01-20"],
  ["hinojosa-death", "Hinojosa CNN interview", "https://transcripts.cnn.com/show/arena/date/2026-10-08/segment/01", "2026-10-08"],
  ["dixon-schools", "Dixon school policy", "https://patdixon.org/school-choice/", "2026-05-28"],
  ["dixon-cannabis", "Dixon cannabis questionnaire", "https://patdixon.org/texas-cannabis-policy-questionnaire/", "2026-09-29"],
  ["dixon-death", "Dixon death penalty statement", "https://patdixon.org/death-penalty/", "2026-10-13"],
  ["dixon-abortion", "Dixon abortion statement", "https://patdixon.org/abortion/", "2026-09-21"],
  ["dixon-voter", "Dixon response to a voter", "https://patdixon.org/response-to-a-voter-10-23-26/", "2026-10-26"],
];
await mkdir("data/official/governor-research", { recursive: true });
const receipts = [];
for (const [id, title, url, publishedAt] of sources) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Source retrieval failed: ${id} (${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 1_000_000) throw new Error(`Source exceeds the authorized small-page limit: ${id}`);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  await writeFile(`data/official/governor-research/${sha256}.html`, bytes, { flag: "wx" }).catch((error) => { if (error.code !== "EEXIST") throw error; });
  receipts.push({ id, title, url, publishedAt, sha256, retrievedAt: new Date().toISOString() });
}
await writeFile("data/official/governor-research/source-receipts.json", JSON.stringify(receipts, null, 2) + "\n");
console.log(JSON.stringify({ archived: receipts.length, contactInformationExtracted: false }));

import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const sources = [
  ["paxton-platform", "Paxton Senate platform", "https://www.kenpaxton.com/issues", null, "border wall"],
  ["paxton-aca", "Paxton ACA challenge and stated repeal goal", "https://www.texasattorneygeneral.gov/news/releases/ag-paxton-and-wisconsin-ag-file-20-state-lawsuit-end-grip-obamacare-texas-and-nation", "2018-02-26", "effectively repeal"],
  ["paxton-abortion", "Paxton statement on Roe reversal", "https://www.texasattorneygeneral.gov/news/releases/ag-paxton-celebrates-end-roe-v-wade-announces-abortion-now-illegal-texas", "2022-06-24", "question of abortion returns"],
  ["paxton-guns", "Paxton private-firearm-sales challenge", "https://www.texasattorneygeneral.gov/news/releases/attorney-general-ken-paxton-secures-injunction-stopping-biden-administrations-unlawful-attempt-ban", "2024-06-12", "private sale of guns"],
  ["paxton-tariffs", "Paxton tariff response to the Houston Chronicle", "https://www.houstonchronicle.com/projects/politics/texas/trump-tariff-lawmaker-reactions/", "2025-04-10", "Ken Paxton"],
  ["talarico-health", "Talarico federal health priorities", "https://jamestalarico.com/issue/health-care/", null, "Affordable Care Act"],
  ["talarico-freedom", "Talarico reproductive and family policy", "https://jamestalarico.com/issue/freedom-family-faith/", null, "paid family leave"],
  ["talarico-safety", "Talarico gun and cannabis policy", "https://jamestalarico.com/issue/public-safety-justice/", null, "universal background checks"],
  ["talarico-taxes", "Talarico trade and cost-of-living policy", "https://jamestalarico.com/issue/taxes-cost-of-living/", null, "tariffs"],
  ["brown-platform", "Ted Brown federal policy platform", "https://www.tedbrown.org/website/index.html", null, "Free Trade"],
  ["hall-platform", "Hall adopted positions and undecided issues", "https://senate.deadliftradio.com/positions.html", null, "legal, regulated marijuana"],
  ["ayers-platform", "Ayers issue priorities", "https://ayers4.us/issues", null, "Healthcare"],
  ["mohamed-platform", "Mohamed policy agenda", "https://zulmohamedfortexas.com/vote-new-america/", null, "Agenda"],
  ["simmons-platform", "Simmons campaign priorities", "https://www.jadesimmonsforsenate.com/faqs", null, "Healthcare"],
];
await mkdir("data/official/senate-research", { recursive: true });
const fetched = await Promise.allSettled(sources.map(async ([id, title, url, publishedAt, expected]) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Source unavailable: ${id} (${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 1_000_000) throw new Error(`Source too large: ${id}`);
  if (!bytes.toString("utf8").toLowerCase().includes(expected.toLowerCase())) throw new Error(`Expected source text missing: ${id}`);
  return { bytes, receipt: { id, title, url, publishedAt, sha256: createHash("sha256").update(bytes).digest("hex"), retrievedAt: new Date().toISOString() } };
}));
const receipts = [];
for (let i = 0; i < fetched.length; i++) {
  const result = fetched[i];
  if (result.status === "rejected") { console.log(JSON.stringify({ source: sources[i][0], archived: false, reason: result.reason.message })); continue; }
  const { bytes, receipt } = result.value;
  await writeFile(`data/official/senate-research/${receipt.sha256}.html`, bytes, { flag: "wx" }).catch((error) => { if (error.code !== "EEXIST") throw error; });
  receipts.push(receipt);
}
await writeFile("data/official/senate-research/source-receipts.json", JSON.stringify(receipts, null, 2) + "\n");
console.log(JSON.stringify({ archived: receipts.length, requested: sources.length }));
if (receipts.length !== sources.length) process.exitCode = 2;

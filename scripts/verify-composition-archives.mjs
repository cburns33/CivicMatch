// Verify source bytes for a mapping draft. The receipt is an automated check,
// never a human style attestation, mapping acceptance, or publish instruction.
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
const sha = process.argv[2];
if (!/^[a-f0-9]{64}$/.test(sha || "")) throw new Error("Supply a mapping draft SHA-256");
const store = join(import.meta.dirname, "../data/official");
const artifact = JSON.parse(await readFile(join(store, "normalized", `${sha}.json`), "utf8"));
const db = new PGlite();
try {
  const result = await db.query("select encode(sha256(convert_to($1::jsonb::text,'UTF8')),'hex') as sha", [JSON.stringify(artifact)]);
  if (result.rows[0].sha !== sha) throw new Error("Mapping draft file differs from its database checksum");
} finally { await db.close(); }
const run = JSON.parse(await readFile(join(store, "runs", `${artifact.normalized.runId}.json`), "utf8"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
for (const source of artifact.normalized.sources) {
  const archived = run.documents.find((d) => d.source.sha256 === source.sha256)?.source;
  const extension = source.mediaType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ? "xlsx" : "pdf";
  if (!archived || !/^[a-f0-9]{64}$/.test(source.sha256) || archived.archivePath !== `documents/${source.sha256}.${extension}`) throw new Error("Invalid contributing source reference");
  const bytes = await readFile(join(store, archived.archivePath));
  if (hash(bytes) !== source.sha256 || bytes.length !== source.bytes) throw new Error("Contributing source archive changed");
}
const receipt = { schemaVersion: 1, draftSha256: sha, runId: artifact.normalized.runId,
  normalizedArtifactFileSha256: hash(await readFile(join(store, "normalized", `${sha}.json`))),
  sourceManifest: artifact.normalized.sources, checkedAt: new Date().toISOString(),
  sourceBytesVerified: true, humanReviewPerformed: false, publicationPerformed: false };
const body = JSON.stringify(receipt, null, 2);
await mkdir("output/composition", { recursive: true });
await writeFile(`output/composition/${sha}-archives.json`, body);
console.log(JSON.stringify({ draftSha256: sha, sourcesChecked: receipt.sourceManifest.length, receiptSha256: hash(body), humanReviewPerformed: false, publicationPerformed: false }));

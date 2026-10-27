export type MappingStatus = { draftSha256: string; ready: boolean; blockers: string[] };
const labels: Record<string, string> = {
  mapping_incomplete: "Jurisdiction, district, and office assignments need review.",
  mapping_review_missing: "The mapping needs a named reviewer’s approval.",
  source_reviews_or_blockers_open: "Source reviews and import blockers remain open.",
  official_style_evidence_missing: "Independent official ballot styles need verification.",
  contest_style_coverage_incomplete: "Contest membership in official styles is incomplete.",
  archive_verification_missing: "Contributing source files need checksum verification.",
  publication_baseline_changed: "Compare this mapping with the latest published baseline.",
  newer_source_import_exists: "A newer source import needs mapping and review.",
  failed_source_import: "The source import failed validation.",
};

export function CompositionMappingStatus({ status }: { status: MappingStatus | null }) {
  return <aside className="official-document" aria-labelledby="mapping-title">
    <h2 id="mapping-title">Composition mapping</h2>
    {!status ? <p>A normalized mapping draft has not been prepared for this import.</p> : <>
      <p><strong>{status.ready ? "Checks passed for a trusted publication transaction." : "Draft prepared. Publication is blocked."}</strong></p>
      <ul>{status.blockers.map((code) => <li key={code}>{labels[code] || code.replaceAll("_", " ")}</li>)}</ul>
      <p>Draft reference: {status.draftSha256.slice(0, 12)}. This status check creates no approval or publication.</p>
    </>}
  </aside>;
}

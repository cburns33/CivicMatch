export type Readiness = {
  runId: string; county: string; isLatestImport: boolean; importStatus: string;
  total: number; accepted: number; open: number; reviewableOpen: number; blocked: number;
  unreviewed: number; needsSource: number; rejected: number; reviewComplete: boolean;
  byKind: Record<string, { total: number; accepted: number; open: number }>;
  blockers: { code: string; count: number }[]; publicationEnabled: false;
};

export const reviewKinds = {
  source: "Sources", record: "Ballot records", change: "Changes",
  issue: "Review flags", write_in: "Write-ins", cancellation: "Cancellations",
};
const blockerNames: Record<string, string> = {
  ballot_styles_unverified: "Official ballot styles need verification",
  cancellation_document_type_unverified: "Cancellation document needs correction",
  unnamed_write_in_slot: "Named write-in needs official evidence",
  failed_import: "Import failed validation",
};

export function ReviewReadiness({ readiness }: { readiness: Readiness }) {
  return <aside className="official-document" aria-labelledby="readiness-title">
    <h2 id="readiness-title">Review readiness</h2>
    {!readiness.isLatestImport && <p><strong>Historical import.</strong> A newer import is available. Decisions stay with the import reviewed.</p>}
    {readiness.importStatus === "failed" && <p><strong>Import failed validation.</strong> A corrected import is required.</p>}
    <p>{readiness.accepted} of {readiness.total} tasks accepted. {readiness.reviewableOpen} open tasks can be reviewed now; {readiness.blocked} require a new import.</p>
    <p>{readiness.unreviewed} have no decision. {readiness.needsSource} need more evidence. {readiness.rejected} were rejected.</p>
    <ul>{Object.entries(reviewKinds).filter(([kind]) => readiness.byKind[kind]).map(([kind, label]) => <li key={kind}>
      {label}: {readiness.byKind[kind].accepted} accepted, {readiness.byKind[kind].open} open.
    </li>)}</ul>
    {readiness.blockers.length > 0 && <><h3>Evidence needed for a new import</h3><ul>
      {readiness.blockers.map((blocker) => <li key={blocker.code}>{blockerNames[blocker.code] || blocker.code.replaceAll("_", " ")}: {blocker.count}.</li>)}
    </ul></>}
    <h3>Still needed before publication</h3>
    <p>{readiness.reviewComplete ? "Task review is complete for this import." : "Task review remains incomplete."} Publication remains unavailable.</p>
    <p>Official style and address checks, validated composition mapping, and a trusted publisher are separate requirements. Accepting tasks cannot publish a ballot.</p>
  </aside>;
}

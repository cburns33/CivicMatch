import Link from "next/link";
import { ArrowUpRight, FileText, Info } from "lucide-react";
import rawStatus from "@/data/official-source-status.json";
import rawStyles from "@/data/official-style-status.json";
import { officialIntakeSchema, officialStyleStatusSchema } from "@/domain/official-intake";

export const metadata = { title: "Official source intake" };
const status = officialIntakeSchema.parse(rawStatus);
const styles = officialStyleStatusSchema.parse(rawStyles);
if (styles.counties.some((c) => !status.counties.some((s) => s.county === c.county && s.runId === c.runId)))
  throw new Error("Style report must match the current county imports.");
const sourceLabels = {
  master_ballot: "Consolidated sample ballot",
  write_ins: "Write-in candidate notice",
  cancellations: "Cancellation notice",
  supporting_reference: "Election scope reference",
};

export default function OfficialData() {
  return (
    <article className="document-page">
      <div className="eyebrow">M2 · OFFICIAL SOURCE INTAKE</div>
      <h1>Building from the official record.</h1>
      <p className="lede">
        Travis and Harris County source documents for the November 3, 2026
        election are archived. Races, propositions, write-ins, and cancellation
        notices are staged for review.
      </p>
      <div className="fixture-notice" role="note">
        <Info size={22} aria-hidden="true" />
        <div>
          <strong>County references, with review still pending.</strong>
          <p>
            These consolidated documents cover many districts. They cannot
            identify your individual ballot. Address matching and composition
            approval remain pending.
          </p>
        </div>
      </div>
      {status.counties.map((county) => (
        <section
          className="official-county"
          key={county.county}
          aria-labelledby={`${county.county}-title`}
        >
          <h2 id={`${county.county}-title`}>
            {county.county === "travis" ? "Travis County" : "Harris County"}
          </h2>
          <p>
            <strong>
              {county.status === "failed"
                ? "Import requires investigation"
                : "Awaiting review"}
            </strong>{" "}
            · {county.stagedContestCount} candidate contests and{" "}
            {county.stagedCandidateCount} printed candidate entries staged.
          </p>
          <p>
            {county.stagedMeasureCount} proposition records and{" "}
            {county.declarationBlockCount} unopposed declaration blocks preserved.
            All {county.sourceChoiceCount} printed ballot choices are assigned to
            source regions across every master-ballot page. This checks extraction
            coverage; composition and individual eligibility still need review.
          </p>
          <p>
            {county.matchedWriteInCount} named write-in entries match printed slots.
            The printed candidate list and certified write-in list remain separate.
            Each match retains its source document and awaits approval.
          </p>
          <p>
            {county.cancellationScopeCount} cancellation scopes checked: {county.cancellationMatches.corroborates_declaration}{" "}
            support unopposed declarations, {county.cancellationMatches.possible_active_conflict}{" "}
            may conflict with active races, and {county.cancellationMatches.scope_review_required}{" "}
            need source clarification. Other notices have no matching candidate
            contest in the master. Cancellation checks preserve every ballot record.
          </p>
          {county.scopeSupportedMeasureCount > 0 && <p>
            {county.scopeSupportedMeasureCount} proposition variants now have separate electorate scopes supported by the official election order.
            {" "}{county.corroboratedCancellationScopeCount} cancellation scope is corroborated by a second official order, with its source limitation preserved. These assessments await composition review.
          </p>}
          {county.sources.filter((source) => source.kind !== "cancellations").map((source) => (
            <div className="official-document" key={source.sha256}>
              <h3>
                <FileText size={17} aria-hidden="true" />
                {source.kind === "supporting_reference" ? source.title : sourceLabels[source.kind]}
              </h3>
              <p>
                {source.extractionScope === "filtered_workbook" ? `${source.pageCount} worksheet archived · Filtered official candidate export` : `${source.pageCount} pages archived · ${source.pagesWithText} pages with extractable text`} · Retrieved{" "}
                {new Intl.DateTimeFormat("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  timeZone: "America/Chicago",
                }).format(new Date(source.retrievedAt))}
              </p>
              {source.extractionScope === "targeted_first_page" && <p>Scope review uses page 1. The complete PDF is archived; other reference pages remain outside this targeted extraction.</p>}
              {source.extractionScope === "filtered_workbook" && <p>The archived source is the portal’s unchanged workbook export. To reproduce it, select 2026, November General Election, County, Travis, and County Clerk, then choose Export results. The source link opens the portal.</p>}
              <div className="official-source-links">
                <a href={source.url} target="_blank" rel="noreferrer">
                  Open official document{" "}
                  <ArrowUpRight size={14} aria-hidden="true" />
                  <span className="sr-only"> (opens a new tab)</span>
                </a>
                <a href={source.discoveryUrl} target="_blank" rel="noreferrer">
                  Official source page{" "}
                  <ArrowUpRight size={14} aria-hidden="true" />
                  <span className="sr-only"> (opens a new tab)</span>
                </a>
              </div>
              <details>
                <summary>Source checksum and retrieval details</summary>
                <dl>
                  <dt>SHA-256 of archived source bytes</dt>
                  <dd className="source-checksum">{source.sha256}</dd>
                  <dt>Retrieved at (UTC)</dt>
                  <dd>{source.retrievedAt}</dd>
                  <dt>File size</dt>
                  <dd>{source.bytes.toLocaleString("en-US")} bytes</dd>
                </dl>
              </details>
            </div>
          ))}
          <details className="review-issues">
            <summary>{county.sources.filter((source) => source.kind === "cancellations").length} cancellation documents and archive details</summary>
            {county.sources.filter((source) => source.kind === "cancellations").map((source) => (
              <div className="official-document" key={`${source.sha256}-${source.title}`}>
                <h3>{source.title}</h3>
                <p>{source.pageCount} pages archived · {source.pagesWithOcr} pages with unverified machine transcription</p>
                <div className="official-source-links">
                  <a href={source.url} target="_blank" rel="noreferrer">Open official document <ArrowUpRight size={14} aria-hidden="true" /><span className="sr-only"> (opens a new tab)</span></a>
                  <a href={source.discoveryUrl} target="_blank" rel="noreferrer">Official source page <ArrowUpRight size={14} aria-hidden="true" /><span className="sr-only"> (opens a new tab)</span></a>
                </div>
                <details>
                  <summary>Source checksum and retrieval details</summary>
                  <dl>
                    <dt>SHA-256 of archived PDF bytes</dt><dd className="source-checksum">{source.sha256}</dd>
                    <dt>Retrieved at (UTC)</dt><dd>{source.retrievedAt}</dd>
                    <dt>File size</dt><dd>{source.bytes.toLocaleString("en-US")} bytes</dd>
                  </dl>
                </details>
              </div>
            ))}
          </details>
          <details className="review-issues">
            <summary>What remains before approval</summary>
            <ul>
              {county.issues.map((issue, index) => (
                <li key={`${issue.code}-${index}`}>{issue.message}</li>
              ))}
            </ul>
            <p>
              Adapter: {county.adapterVersion}. No official ballot style or
              reviewed composition snapshot has been published.
            </p>
          </details>
        </section>
      ))}
      <h2>Ballot style validation</h2>
      {styles.counties.map((county) => <p key={county.county}>
        <strong>{county.county === "travis" ? "Travis County" : "Harris County"}:</strong>{" "}
        {county.referenceCount} individual style references checked, {county.officiallyVerifiedCount} verified styles,
        and {county.addressFixtureCount} verified address examples. Personalized ballots remain unavailable.
      </p>)}
      <p>
        The current county lookup forms use voter information. Public style references
        are still needed to check which contests belong together without accessing voter records.
        Automated comparisons check contest order, candidate names, write-ins, voting instructions,
        proposition wording, and electorate variants. Human review is required before use.
      </p>
      <h2>Review before use.</h2>
      <p>
        Staged candidate records remain outside the public ballot explorer until
        composition review is complete. The explorer still uses labeled
        synthetic fixtures. Official county documents are available above while
        structured imports are checked.
      </p>
      <Link className="text-link" href="/sources">
        Find your county’s official ballot lookup →
      </Link>
    </article>
  );
}

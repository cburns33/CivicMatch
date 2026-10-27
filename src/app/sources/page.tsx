import Link from "next/link";
import { ArrowUpRight, FlaskConical } from "lucide-react";
export const metadata = { title: "Sources & corrections" };
const offices = [
  ["Travis County", "https://votetravis.gov/voter-lookup/"],
  ["Harris County", "https://www.harrisvotes.com/Voter/Whats-on-my-Ballot"],
  ["Williamson County", "https://apps.wilcotx.gov/elections/voterlookup/"],
  ["Hays County", "https://www.hayscountytx.gov/172/Elections"],
  [
    "Fort Bend County",
    "https://www.fortbendcountytx.gov/government/departments/elections-voter-registration",
  ],
  ["Montgomery County", "https://elections.mctx.org/"],
];
export default function Sources() {
  return (
    <article className="document-page">
      <div className="eyebrow">SOURCE TRANSPARENCY</div>
      <h1>Start with the official record.</h1>
      <p>
        <Link className="text-link" href="/official-data">
          View Travis and Harris official source intake →
        </Link>
      </p>
      <div className="fixture-notice">
        <FlaskConical aria-hidden="true" size={22} />
        <div>
          <strong>This preview contains synthetic fixtures.</strong>
          <p>
            Official links below are navigation resources. They are not
            citations for the test candidates, districts, or measures.
          </p>
        </div>
      </div>
      <h2>Find your official ballot.</h2>
      <p>
        Austin and Houston extend across county boundaries. Confirm your county
        and use its official election resources. This preview has no address
        lookup and cannot verify a voter’s ballot or eligibility.
      </p>
      <div className="office-links">
        {offices.map(([name, url]) => (
          <a key={name} href={url} target="_blank" rel="noreferrer">
            {name}
            <ArrowUpRight size={17} aria-hidden="true" />
            <span className="sr-only"> (opens a new tab)</span>
          </a>
        ))}
      </div>
      <p>
        Additional jurisdictions may be needed. The{" "}
        <a href="https://www.sos.texas.gov/elections/laws/2026-november-general-election.shtml">
          Texas Secretary of State’s current election page
        </a>{" "}
        is another official starting point.
      </p>
      <h2>A traceable record.</h2>
      <p>
        M1 models source retrieval time, SHA-256 checksums, adapter versions,
        import diffs, reviewer decisions, and immutable publication snapshots.
        The test ballot uses an explicit fixture reference, fixture-document-v1,
        with no invented citation or claimed official source.
      </p>
      <h2>Corrections without erasing history.</h2>
      <p>
        Future corrections will cite the affected snapshot, supporting source,
        review decision, and replacement snapshot. Earlier published snapshots
        will remain unchanged. No submission service is active in M1.
        Development feedback can be recorded as a repository issue.
      </p>
      <Link className="text-link" href="/">
        Return to the test ballot →
      </Link>
    </article>
  );
}

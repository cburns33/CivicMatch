import Link from "next/link";
import {
  claimKinds,
  evidenceConfidenceLevels,
  evidenceMethodologyVersion,
} from "@/domain/research";
export const metadata = { title: "Comparison methodology" };
export default function Methodology() {
  return (
    <article className="document-page">
      <div className="eyebrow">OPEN METHODOLOGY · SCORING PROPOSAL V1</div>
      <h1>Understand the comparison.</h1>
      <p className="lede">
        One quiz groups fourteen questions into five issues, then compares your
        views with all fourteen governor and U.S. Senate candidates in our current
        coverage. Importance ratings and answers stay on your device. This friends early-access version uses
        sourced, AI-assisted provisional candidate mappings. Coverage limits,
        source links, and interpretations appear alongside results.
      </p>
      <p>
        State and federal questions carry office labels. Each candidate's
        denominator includes only questions relevant to their office. Answering
        a governor question never supplies your answer to a federal question.
        You can skip, revisit issues, review your importance ratings, and edit
        your answers before or after viewing all candidate comparisons.
      </p>
      <h2>Ballot and research coverage are independent.</h2>
      <p>
        Official election records will establish contests, candidate names,
        proposition wording, and ballot styles. A contest stays on the ballot
        when its candidate research is incomplete. City selection does not
        establish a voter’s county, districts, or eligibility.
      </p>
      <h2>Coverage and confidence answer different questions.</h2>
      <p>
        Research coverage measures how many questions relevant to an office have
        reviewed candidate evidence. Your comparison coverage measures how many
        of your applicable answers can be compared with that candidate. Evidence
        confidence describes the support for one specific claim. We will report
        these separately, with their question counts and limitations.
      </p>
      <p>
        Repeated articles about the same statement cover one issue. Reports that
        repeat the same underlying source do not provide independent
        corroboration. Extensive coverage of one issue cannot establish
        knowledge of a candidate’s positions on other issues.
      </p>
      <h2>Actions, interpretations, and motives stay separate.</h2>
      <p>
        Our review standard, {evidenceMethodologyVersion}, keeps each claim in
        an explicit category. The same event can support several claims with
        different evidence and confidence labels.
      </p>
      <div className="table-scroll">
        <table>
          <caption>What each type of claim establishes</caption>
          <thead>
            <tr>
              <th scope="col">Claim type</th>
              <th scope="col">Review standard</th>
            </tr>
          </thead>
          <tbody>
            {claimKinds.map((kind) => (
              <tr key={kind.value}>
                <th scope="row">{kind.label}</th>
                <td>{kind.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        A verified vote can establish support for a particular bill at a
        particular stage. It can require interpretation to map that vote to one
        policy question when the bill contains several provisions. Candidate
        statements and documented actions are shown together with their scope,
        dates, and any discrepancies. There is no automatic multiplier that
        makes an action worth a fixed number of statements.
      </p>
      <h2>Confidence follows the supporting evidence.</h2>
      <div className="table-scroll">
        <table>
          <caption>Evidence confidence labels, assessed claim by claim</caption>
          <thead>
            <tr>
              <th scope="col">Label</th>
              <th scope="col">Supporting evidence</th>
            </tr>
          </thead>
          <tbody>
            {evidenceConfidenceLevels.map((level) => (
              <tr key={level.value}>
                <th scope="row">{level.label}</th>
                <td>{level.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Each assessment needs source references and an explanation of what they
        support. Reviewers check authenticity, directness, context, timing,
        independent corroboration, missing information, and contradictory
        evidence. Confidence in the action, a reported perception, and the
        proposed motive is assessed separately. These labels are qualitative and
        carry no numerical probability or scoring multiplier.
      </p>
      <p>
        An insider’s role, relevant political affiliation, access, and
        perspective provide context for their account. We distinguish firsthand
        observations, secondhand chatter, and later recollection. Reviewer
        certainty is recorded separately from evidence confidence. Credentials,
        affiliation, and repeated retellings alone cannot justify stronger
        support.
      </p>
      <p>
        A source may provide strong evidence that a perception was expressed
        within a particular political circle. Establishing the candidate’s
        actual motive requires evidence that bears on that separate claim. A
        candidate’s stated motive remains attributed. Alternative explanations
        and limits stay visible for inferred motives. Chronology, expected
        future events, attempted strategy, and eventual results are reviewed as
        separate facts.
      </p>
      <h2>Review context never supplies a policy answer.</h2>
      <p>
        Reviewers keep their own policy preferences separate from the
        candidate’s position. Insider interpretations and inferred motives
        remain attributed research context and are excluded from policy
        agreement and policy-evidence coverage. A policy position needs its own
        reviewed action or statement evidence, an explained mapping to the
        question, and resolved material conflicts. Changes to assessments retain
        the source record and review history.
      </p>
      <h2>Your policy response and its importance are separate.</h2>
      <p>
        The proposed policy scale is 1 (strongly disagree) through 5 (strongly
        agree). Neutral or unsure is an answered value of 3. Skip stores an
        explicit skipped state and null value. An untouched question has a
        separate unanswered state.
      </p>
      <div className="table-scroll">
        <table>
          <caption>Proposed independent importance weights</caption>
          <thead>
            <tr>
              <th>Importance response</th>
              <th>Weight</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Not answered", "1.00"],
              ["Least important to me", "0.50"],
              ["Less important", "0.75"],
              ["Average importance", "1.00"],
              ["More important", "1.50"],
              ["Most important to me", "2.00"],
            ].map(([label, weight]) => (
              <tr key={label}>
                <td>{label}</td>
                <td>{weight}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Several questions may share the same importance level, including the
        highest level. No fixed pool of points is required. The highest weight
        has four times the influence of the lowest weight. Importance changes
        influence, leaving policy responses intact.
      </p>
      <h2>A deterministic, versioned calculation.</h2>
      <p>
        For each eligible question, agreement = 1 − |user position − reviewed
        candidate position| / 4. Weighted agreement = sum(agreement × weight) /
        sum(weight). Only applicable answered questions with approved candidate
        evidence and no unresolved or ambiguous conflict enter the denominator.
      </p>
      <p>
        Evidence coverage is reported separately: comparable questions divided
        by applicable answered questions. Skipped and untouched questions are
        excluded. A zero denominator produces an insufficient-information state.
      </p>
      <h2>Enough information before a percentage.</h2>
      <p>
        The selected-race guide requires 5 applicable answers, 5 comparable
        questions, and 60% evidence coverage. Results preserve source order.
        Provisional mappings are labeled. Missing positions and unresolved
        interpretations stay unscored. The guide presents evidence and
        agreement without endorsements or rankings.
      </p>
      <h2>Review, revise, reproduce.</h2>
      <p>
        The guide identifies its question revisions, research version, source
        references, and scoring method. Your answers and importance ratings are
        saved on this device, with no account or server sync. The review screen
        distinguishes directional, neutral, skipped, and unanswered responses.
        Results include equal-weight sensitivity and a gated high-priority
        subset. Print a comparison to retain the displayed version and answers.
      </p>
      <h2>Evidence first.</h2>
      <p>
        Party membership never supplies a missing position. Recorded votes,
        statements, and interpretations remain distinct. Each provisional
        mapping explains its evidence and interpretation. Conflicting evidence remains
        visible in the research record and reduces coverage when unresolved.
      </p>
      <Link className="text-link" href="/">
        Return to the issue quiz →
      </Link>
    </article>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, ExternalLink, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { governorCandidates as defaultCandidates, governorQuestions as defaultQuestions, rosterSources } from "@/data/governor-guide";
import { answerLabels, answerStorageKey, blankAnswer, compareCandidate, importanceLabels, restoreAnswers, type Answer, type Answers, type ResearchPacket, type QuizRace } from "@/domain/comparison";

type Stage = "guide" | "questions" | "review" | "results";

export function RaceComparison({ research, preview = false, race, answers: suppliedAnswers }: { research: ResearchPacket; preview?: boolean; race?: QuizRace; answers?: Answers }) {
  const candidates = race?.candidates ?? defaultCandidates;
  const questions = race?.questions ?? defaultQuestions;
  const resultsOnly = suppliedAnswers !== undefined;
  const [localAnswers, setAnswers] = useState<Answers>({});
  const answers = suppliedAnswers ?? localAnswers;
  const [stage, setStage] = useState<Stage>(resultsOnly ? "results" : "guide");
  const [storageMessage, setStorageMessage] = useState("");
  const [ready, setReady] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (resultsOnly) return;
    try { setAnswers(restoreAnswers(localStorage.getItem(answerStorageKey), questions)); }
    catch { setStorageMessage("Device storage is unavailable. Your answers will last for this visit."); }
    setReady(true);
  }, [resultsOnly, questions]);
  useEffect(() => { if (!resultsOnly) heading.current?.focus(); }, [stage, resultsOnly]);

  function save(next: Answers) {
    setAnswers(next);
    try { localStorage.setItem(answerStorageKey, JSON.stringify({ version: 1, answers: next })); }
    catch { setStorageMessage("Your latest answers could not be saved on this device. Keep this page open to retain them."); }
  }
  function change(id: string, update: Partial<Answer>) { save({ ...answers, [id]: { ...(answers[id] ?? blankAnswer), ...update } }); }
  function forget() {
    setAnswers({}); setStage("guide");
    try { localStorage.removeItem(answerStorageKey); setStorageMessage("Your saved answers have been cleared from this device."); }
    catch { setStorageMessage("Answers cleared for this visit. Your browser did not allow removal from device storage."); }
  }
  const answered = questions.filter((q) => answers[q.id]?.state === "answered").length;
  const skipped = questions.filter((q) => answers[q.id]?.state === "skipped").length;
  const available = research.review.status !== "pending" || preview;
  const provisional = research.review.status === "provisional";
  const results = candidates.map((candidate) => ({ candidate, result: compareCandidate(candidate.id, questions, answers, research, preview) }));
  const common = questions.filter((q) => results.every(({ result }) => result.includedQuestions.includes(q.id)));

  return <div className="race-guide">
    {preview && <div className="race-notice" role="note"><strong>Private research preview.</strong> These are proposed mappings awaiting human review. Preview calculations are excluded from the public release. Version: {research.version}.</div>}
    {!resultsOnly && provisional && <div className="race-notice" role="note"><p><strong>Friends early access.</strong> Candidate comparisons use sourced, AI-assisted interpretations. These mappings are provisional. Open any topic to inspect the evidence and its limits.</p></div>}
    {!resultsOnly && <><div className="eyebrow">NOVEMBER 3, 2026 · SELECTED RACE GUIDE</div>
    <section className="page-intro"><div><h1 ref={heading} tabIndex={-1}>{stage === "guide" ? <>Your priorities.<br /><em>A clearer comparison.</em></> : stage === "questions" ? "Where do you stand?" : stage === "review" ? "Review your priorities." : "Your issue comparison."}</h1><p>Texas Governor · Seven questions · Your answers stay on this device.</p></div></section>
    <div className="race-notice"><ShieldCheck size={19} aria-hidden="true" /><p>This guide covers one statewide race. Use your county’s official lookup to confirm your complete ballot. Candidate research coverage varies.</p></div>
    <p role="status" aria-live="polite">{storageMessage}</p></>}

    {stage === "guide" && <>
      <div className="race-actions"><Button disabled={!ready} onClick={() => setStage("questions")}>{answered ? "Continue your questions" : "Answer seven questions"}<ArrowRight size={17} aria-hidden="true" /></Button><a className="text-link" href="#candidate-guide">Explore candidates and sources ↓</a></div>
      <div className="race-facts"><div><strong>7 candidates</strong><span>3 printed names + 4 qualified write-ins</span></div><div><strong>No account needed</strong><span>Save, edit, or clear your answers here</span></div><div><strong>Evidence before scores</strong><span>Missing research stays visible</span></div></div>
      <section className="race-panel"><h2>Know what you’re comparing.</h2><p>The governor signs or vetoes legislation, proposes priorities, and makes appointments. Many policy changes also need the Legislature. These seven questions cover selected issues, with two education questions. They do not measure every aspect of the office or a candidate’s qualifications.</p><p>Agreement reflects documented policy positions. It does not measure character, effectiveness, or likelihood of keeping a promise.</p><Link className="text-link" href="/methodology">Read the evidence standard <BookOpen size={15} aria-hidden="true" /></Link></section>
    </>}

    {stage === "questions" && <>
      <p className="race-progress" role="status">{answered} of {questions.length} answered · {skipped} skipped</p>
      <form onSubmit={(event) => { event.preventDefault(); setStage("review"); }}>
        {questions.map((question, index) => { const answer = answers[question.id] ?? blankAnswer; return <section className="race-panel" key={question.id}>
          <div className="eyebrow">{index + 1} / {questions.length} · {question.topic}</div>
          <fieldset className="race-question"><legend>{question.statement}</legend><p id={`${question.id}-context`}>{question.context}</p><div className="race-options" aria-describedby={`${question.id}-context`}>{answerLabels.map((label, i) => <label key={label}><input type="radio" name={question.id} value={i + 1} checked={answer.state === "answered" && answer.value === i + 1} onChange={() => change(question.id, { state: "answered", value: i + 1 })} /><span>{label}</span></label>)}</div></fieldset>
          <div className="race-question-footer"><label>Importance to you<select value={answer.importance ?? ""} onChange={(event) => change(question.id, { importance: event.target.value ? Number(event.target.value) : null })}><option value="">Not rated (standard weight)</option>{importanceLabels.map((label, i) => <option key={label} value={i + 1}>{label}</option>)}</select></label><Button type="button" variant="outline" onClick={() => change(question.id, { state: "skipped", value: null })}>{answer.state === "skipped" ? "Skipped" : "Skip this question"}</Button>{answer.state !== "unanswered" && <button className="text-link" type="button" onClick={() => change(question.id, { state: "unanswered", value: null })}>Clear answer</button>}</div>
        </section>; })}
        <div className="race-actions"><Button type="submit">Review answers <ArrowRight size={17} aria-hidden="true" /></Button><Button type="button" variant="outline" onClick={() => setStage("guide")}>Back to guide</Button></div>
      </form>
    </>}

    {stage === "review" && <section className="race-panel">
      <p>{answered} answered, including {questions.filter((q) => answers[q.id]?.state === "answered" && answers[q.id].value === 3).length} neutral · {skipped} skipped · {questions.length - answered - skipped} unanswered.</p>
      <p>Importance is independent for each question. Several questions can be your most important. Unrated importance uses a weight of 1.</p>
      <ul className="race-review-list">{questions.map((q) => { const answer = answers[q.id] ?? blankAnswer; return <li key={q.id}><strong>{q.topic}</strong><span>{answer.state === "answered" ? answerLabels[answer.value! - 1] : answer.state === "skipped" ? "Skipped" : "Unanswered"}</span><span>{answer.importance === null ? "Importance not rated" : importanceLabels[answer.importance - 1]}</span></li>; })}</ul>
      <p>{questions.filter((q) => answers[q.id]?.state === "answered" && answers[q.id].importance === null).length} answered questions have unrated importance. {questions.filter((q) => answers[q.id]?.state === "answered" && (answers[q.id].importance ?? 0) >= 4).length} have more or most importance.</p>
      <p>Comparable questions available: {results.map(({ candidate, result }) => `${candidate.name}: ${result.comparable}/${result.answered}`).join("; ")}.</p>
      <div className="race-actions"><Button onClick={() => setStage("results")}>See comparison <CheckCircle2 size={17} aria-hidden="true" /></Button><Button variant="outline" onClick={() => setStage("questions")}>Edit answers and importance</Button></div>
    </section>}

    {!resultsOnly && stage === "results" && <>
      <section className="race-panel"><h2>How to read this comparison</h2><p>Scores need at least five answered questions, five supported comparisons, and 60% comparison coverage. A missing stance is excluded. Neutral answers count; skipped and unanswered questions do not.</p><p>Formula: 100 × the weighted average of (1 − answer distance ÷ 4). Importance weights: 0.5, 0.75, 1, 1.5, 2. Evidence strength does not multiply the score.</p><p>Research coverage counts supported questions out of all seven. Comparison coverage counts supported questions out of your answered questions. Different candidates may be compared on different questions. {common.length} of your answered questions are comparable across all seven candidates.</p><p>Weights and display thresholds use civicmatch-weighted-distance v1. Results retain source order and provide no endorsement or ranking.</p><div className="race-actions"><Button variant="outline" onClick={() => setStage("questions")}>Edit answers and importance</Button><Button variant="outline" onClick={() => window.print()}>Print this comparison</Button></div></section>
    </>}

    {(stage === "guide" || stage === "results") && <section id={`candidate-guide-${race?.id ?? "governor"}`} aria-labelledby={`candidate-guide-heading-${race?.id ?? "governor"}`}>
      <h2 id={`candidate-guide-heading-${race?.id ?? "governor"}`}>{resultsOnly ? race?.title : stage === "results" ? "Candidates and your answers" : "Candidates and original sources"}</h2>
      {!available && <div className="race-notice"><p><strong>Position review is pending.</strong> Official candidate names and source links are available now. Research summaries and agreement scores appear only after human review. You can save your answers and return.</p></div>}
      {preview && <p>Research coverage below is proposed coverage for review. No human approval is recorded.</p>}
      <div className="race-candidate-grid">{results.map(({ candidate, result }) => <article className="race-panel" key={candidate.id}>
        <div className="eyebrow">{candidate.writeIn ? "QUALIFIED WRITE-IN" : candidate.party}</div><h3>{candidate.name}</h3>{candidate.writeIn && <p>Certified as a write-in. The name is separate from the printed candidates. No party affiliation is inferred.</p>}
        <p>Research coverage: <strong>{result.research}/{questions.length} questions</strong>{preview ? " proposed" : provisional ? " provisionally mapped" : " reviewed"}.</p>
        {stage === "results" && <><p className="race-score">{result.percent === null ? "Insufficient information" : `${Math.round(result.percent)}% policy agreement${preview ? " (preview)" : provisional ? " (provisional)" : ""}`}</p><p>Comparison coverage: {result.comparable}/{result.answered} answered questions ({Math.round(100 * result.coverage)}%). Weighted coverage: {Math.round(100 * result.weightedCoverage)}%.</p>{result.percent !== null && <p>With equal importance: {Math.round(result.equalPercent!)}%. More/most important subset: {result.priorityPercent === null ? "insufficient information" : `${Math.round(result.priorityPercent)}%`}.</p>}<p>Included topics: {result.includedQuestions.length ? questions.filter((q) => result.includedQuestions.includes(q.id)).map((q) => q.topic).join(", ") : "none"}.</p></>}
        {candidate.website && <a className="text-link" href={candidate.website} target="_blank" rel="noreferrer">Candidate’s own website <ExternalLink size={14} aria-hidden="true" /></a>}
        {available && questions.map((question) => {
          const position = research.positions.find((p) => p.candidateId === candidate.id && p.questionId === question.id);
          const user = answers[question.id] ?? blankAnswer;
          return <details className="race-evidence" key={question.id}><summary>{question.topic}: {position?.value !== null && position?.value !== undefined && !position.conflict ? answerLabels[position.value - 1] : "No mapped position"}</summary><p>{question.statement}</p>{stage === "results" && <p>Your answer: {user.state === "answered" ? answerLabels[user.value! - 1] : user.state}.</p>}{position ? <><p><strong>{position.kind === "documented_action" ? "Documented action" : "Recorded statement"}:</strong> {position.summary}</p><p>{position.rationale}</p><p><strong>Evidence support {preview ? "proposed" : provisional ? "(AI assessment)" : "reviewed"}:</strong> {position.confidence === "qualified" ? "Qualified" : "Limited"}. {position.limitations}</p>{position.sourceIds.map((sourceId) => { const source = research.sources.find((s) => s.id === sourceId); return source ? <div key={sourceId}><p><a className="text-link" href={source.url} target="_blank" rel="noreferrer">{source.title} <ExternalLink size={13} aria-hidden="true" /></a><br /><small>Published: {source.publishedAt ?? "not dated"} · Retrieved: {source.retrievedAt.slice(0, 10)}</small></p><details><summary>Source checksum</summary><p className="source-checksum">{source.sha256}</p></details></div> : null; })}</> : <p>No sourced mapping for this question yet. No stance is inferred from party, silence, or another candidate’s position.</p>}</details>;
        })}
      </article>)}</div>
      <div className="race-panel"><h3>Official roster and coverage</h3><p>Names follow the state’s printed-candidate and write-in certifications dated August 28, 2026. Write-ins are listed separately in certification order. This is a race guide, with no individual ballot-style or address verification.</p><div className="race-actions"><a className="text-link" href={rosterSources.printed}>State candidate certification</a><a className="text-link" href={rosterSources.writeIns}>Qualified write-in certification</a></div><p>Research version: {research.version}. {research.review.status === "approved" ? `Reviewed by ${research.review.reviewer} on ${research.review.reviewedAt}.` : provisional ? "AI-assisted provisional research." : "Human review pending."}</p></div>
    </section>}
    {!resultsOnly && <><section className="race-panel"><h2>Check your official ballot</h2><p>Use the election office’s own website to confirm your races, sample ballot, and voting locations. Enter personal lookup information on the official website.</p><div className="race-actions"><a className="text-link" href="https://votetravis.gov/">Travis County Elections <ExternalLink size={14} aria-hidden="true" /></a><a className="text-link" href="https://www.harrisvotes.com/">Harris County Elections <ExternalLink size={14} aria-hidden="true" /></a><a className="text-link" href="https://www.votetexas.gov/">Texas voter information <ExternalLink size={14} aria-hidden="true" /></a></div></section>
    <div className="race-actions"><button type="button" className="text-link" onClick={forget}>Clear my saved answers</button><Link className="text-link" href="/demo">Explore the sample ballot demo</Link></div></>}
  </div>;
}

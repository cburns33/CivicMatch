"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RaceComparison } from "./race-comparison";
import { quizIssues } from "@/data/issue-quiz";
import { answerLabels, answerStorageKey, blankAnswer, importanceLabels, restoreAnswers, unifiedAnswerStorageKey, type Answer, type Answers, type QuizRace } from "@/domain/comparison";

type Stage = "overview" | "questions" | "review" | "results";

export function IssueQuiz({ races }: { races: QuizRace[] }) {
  const questions = useMemo(() => races.flatMap((race) => race.questions), [races]);
  const issues = useMemo(() => quizIssues.map((issue) => ({ ...issue, questions: issue.questionIds.flatMap((id) => questions.filter((question) => question.id === id)) })).filter((issue) => issue.questions.length), [questions]);
  const [answers, setAnswers] = useState<Answers>({});
  const [stage, setStage] = useState<Stage>("overview");
  const [issueIndex, setIssueIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    try {
      const current = localStorage.getItem(unifiedAnswerStorageKey);
      const restored = restoreAnswers(current ?? localStorage.getItem(answerStorageKey), questions);
      setAnswers(restored);
      if (current === null && Object.keys(restored).length) localStorage.setItem(unifiedAnswerStorageKey, JSON.stringify({ version: 1, answers: restored }));
    } catch { setMessage("Device storage is unavailable. Your answers will last for this visit."); }
    setReady(true);
  }, [questions]);
  useEffect(() => { heading.current?.focus(); }, [stage, issueIndex]);

  function change(id: string, update: Partial<Answer>) {
    const next = { ...answers, [id]: { ...(answers[id] ?? blankAnswer), ...update } };
    setAnswers(next);
    try { localStorage.setItem(unifiedAnswerStorageKey, JSON.stringify({ version: 1, answers: next })); }
    catch { setMessage("Your latest answers could not be saved on this device. They remain available for this visit."); }
  }
  function clear() {
    setAnswers({}); setIssueIndex(0); setStage("overview");
    try { localStorage.removeItem(unifiedAnswerStorageKey); localStorage.removeItem(answerStorageKey); setMessage("Your saved quiz answers have been cleared from this device."); }
    catch { setMessage("Answers cleared for this visit. Your browser did not allow removal from device storage."); }
  }
  function start() {
    const incomplete = issues.findIndex((issue) => issue.questions.some((question) => !answers[question.id] || answers[question.id].state === "unanswered"));
    setIssueIndex(incomplete < 0 ? 0 : incomplete); setStage("questions");
  }
  const answered = questions.filter((question) => answers[question.id]?.state === "answered").length;
  const skipped = questions.filter((question) => answers[question.id]?.state === "skipped").length;
  const candidateCount = races.reduce((sum, race) => sum + race.candidates.length, 0);
  const scope = (id: string) => races.filter((race) => race.questions.some((question) => question.id === id)).map((race) => race.title).join(" · ");
  const issue = issues[issueIndex];

  return <div className="race-guide">
    <div className="eyebrow">NOVEMBER 3, 2026 · YOUR ISSUE QUIZ</div>
    <section className="page-intro"><div><h1 ref={heading} tabIndex={-1}>{stage === "overview" ? <>Your views.<br /><em>Issue by issue.</em></> : stage === "questions" ? issue.title : stage === "review" ? "Review your priorities." : "Your candidate comparisons."}</h1><p>{stage === "questions" ? `Issue ${issueIndex + 1} of ${issues.length} · ${issue.description}` : `${questions.length} questions · ${issues.length} issues · ${candidateCount} candidates`}</p></div></section>
    <p role="status" aria-live="polite">{message}</p>
    {stage === "overview" && <>
      <p className="quiz-intro">Answer questions about the issues you care about. At the end, compare your views with every politician in our current coverage.</p>
      <div className="race-actions"><Button disabled={!ready} onClick={start}>{answered || skipped ? "Continue the quiz" : "Start the quiz"}<ArrowRight size={17} aria-hidden="true" /></Button><Link className="text-link" href="/methodology">How comparisons work</Link></div>
      <div className="race-facts"><div><strong>One quiz</strong><span>Questions grouped by issue</span></div><div><strong>All available candidates</strong><span>{races.map((race) => race.title).join(" + ")}</span></div><div><strong>Your answers stay here</strong><span>Save, edit, or clear on this device</span></div></div>
      <section className="race-panel"><h2>What matters to you?</h2><ul className="quiz-issue-list">{issues.map((group) => <li key={group.id}><strong>{group.title}</strong><span>{group.questions.length} questions · {group.description}</span></li>)}</ul></section>
      <p>State and federal questions are labeled. Each politician is compared on questions relevant to their office. Current coverage includes governor and U.S. Senate candidates, including qualified write-ins.</p>
    </>}

    {stage === "questions" && <>
      <nav className="quiz-issue-nav" aria-label="Quiz issues">{issues.map((group, index) => <button type="button" key={group.id} aria-current={index === issueIndex ? "step" : undefined} onClick={() => setIssueIndex(index)}>{index + 1}. {group.title}</button>)}</nav>
      <p className="race-progress" role="status">{answered} of {questions.length} answered · {skipped} skipped</p>
      <form onSubmit={(event) => { event.preventDefault(); if (issueIndex + 1 < issues.length) setIssueIndex(issueIndex + 1); else setStage("review"); }}>
        {issue.questions.map((question) => { const answer = answers[question.id] ?? blankAnswer; return <section className="race-panel" key={question.id}>
          <div className="eyebrow">{question.topic} · {scope(question.id)}</div>
          <fieldset className="race-question"><legend>{question.statement}</legend><p id={`${question.id}-context`}>{question.context}</p><div className="race-options" aria-describedby={`${question.id}-context`}>{answerLabels.map((label, index) => <label key={label}><input type="radio" name={question.id} value={index + 1} checked={answer.state === "answered" && answer.value === index + 1} onChange={() => change(question.id, { state: "answered", value: index + 1 })} /><span>{label}</span></label>)}</div></fieldset>
          <div className="race-question-footer"><label>Importance to you<select value={answer.importance ?? ""} onChange={(event) => change(question.id, { importance: event.target.value ? Number(event.target.value) : null })}><option value="">Not rated (standard weight)</option>{importanceLabels.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select></label><Button type="button" variant="outline" onClick={() => change(question.id, { state: "skipped", value: null })}>{answer.state === "skipped" ? "Skipped" : "Skip this question"}</Button>{answer.state !== "unanswered" && <button type="button" className="text-link" onClick={() => change(question.id, { state: "unanswered", value: null })}>Clear answer</button>}</div>
        </section>; })}
        <div className="race-actions"><Button type="submit">{issueIndex + 1 === issues.length ? "Review all answers" : "Next issue"}<ArrowRight size={17} aria-hidden="true" /></Button>{issueIndex > 0 && <Button type="button" variant="outline" onClick={() => setIssueIndex(issueIndex - 1)}>Previous issue</Button>}<Button type="button" variant="outline" onClick={() => setStage("overview")}>Back to overview</Button></div>
      </form>
    </>}

    {stage === "review" && <section className="race-panel">
      <p>{answered} answered, including {questions.filter((question) => answers[question.id]?.state === "answered" && answers[question.id].value === 3).length} neutral · {skipped} skipped · {questions.length - answered - skipped} unanswered.</p>
      <p>Importance is independent for each question. Several questions can be your most important. Unrated importance uses a weight of 1.</p>
      {issues.map((group) => <section key={group.id}><h2>{group.title}</h2><ul className="race-review-list">{group.questions.map((question) => { const answer = answers[question.id] ?? blankAnswer; return <li key={question.id}><strong>{question.topic}<small className="quiz-scope">{scope(question.id)}</small></strong><span>{answer.state === "answered" ? answerLabels[answer.value! - 1] : answer.state === "skipped" ? "Skipped" : "Unanswered"}</span><span>{answer.importance === null ? "Importance not rated" : importanceLabels[answer.importance - 1]}</span></li>; })}</ul></section>)}
      <p>{questions.filter((question) => answers[question.id]?.state === "answered" && answers[question.id].importance === null).length} answered questions have unrated importance. {questions.filter((question) => answers[question.id]?.state === "answered" && (answers[question.id].importance ?? 0) >= 4).length} have more or most importance.</p>
      <div className="race-actions"><Button onClick={() => setStage("results")}>Compare all candidates <CheckCircle2 size={17} aria-hidden="true" /></Button><Button variant="outline" onClick={() => { setIssueIndex(0); setStage("questions"); }}>Edit answers and importance</Button></div>
    </section>}

    {stage === "results" && <>
      <div className="race-notice"><p><strong>Friends early access.</strong> These are sourced, AI-assisted provisional comparisons. Open any candidate’s issue to inspect the evidence and its limits.</p></div>
      <p>You answered {answered} of {questions.length} questions. All {candidateCount} available candidates appear below, grouped by office. Each result uses only the questions applicable to that office.</p>
      <div className="race-actions"><Button variant="outline" onClick={() => { setIssueIndex(0); setStage("questions"); }}>Edit answers and importance</Button><Button variant="outline" onClick={() => window.print()}>Print my comparisons</Button></div>
      {races.map((race) => <RaceComparison key={race.id} race={race} research={race.research} answers={answers} />)}
      <section className="race-panel"><h2>What the numbers mean</h2><p>Scores need at least five applicable answered questions, five supported comparisons, and 60% comparison coverage. Neutral counts; skipped and unanswered questions do not. An unresearched candidate stays visible with insufficient information.</p><p>Different candidates can have different comparable questions. Research coverage uses all questions for that office; comparison coverage uses your answered questions for that office. Evidence strength does not multiply the score. Results preserve source order and provide no endorsement or ranking.</p><p>Method: civicmatch-weighted-distance v1. Agreement is 100 × the weighted average of (1 − answer distance ÷ 4). Importance weights are 0.5, 0.75, 1, 1.5, and 2; unrated importance uses 1.</p><Link className="text-link" href="/methodology">Read the methodology</Link></section>
    </>}
    {stage !== "questions" && <section className="race-panel"><h2>Check your official ballot</h2><p>Your county’s election office can confirm your complete ballot and voting locations.</p><div className="race-actions"><a className="text-link" href="https://votetravis.gov/">Travis County Elections</a><a className="text-link" href="https://www.harrisvotes.com/">Harris County Elections</a><a className="text-link" href="https://www.votetexas.gov/">Texas voter information</a></div></section>}
    <div className="race-actions"><button type="button" className="text-link" onClick={clear}>Clear my saved answers</button><Link className="text-link" href="/demo">Explore the sample ballot demo</Link></div>
  </div>;
}

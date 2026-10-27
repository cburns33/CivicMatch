"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { ReviewReadiness, reviewKinds, type Readiness } from "@/components/review-readiness";
import { CompositionMappingStatus, type MappingStatus } from "@/components/composition-mapping-status";
import { ResearchPreview } from "@/components/research-preview";

type Progress = { run_sha256: string; county: string; total: number; accepted: number; open: number; requires_new_import: number };
type Task = { id: string; task_key: string; kind: string; payload: Record<string, unknown>; requires_new_import: boolean; matched_total: number; last_decision: { decision: string; note: string; reviewerId: string; decidedAt: string } | null };
type Filters = { kind: string; state: string; query: string };
const defaultFilters: Filters = { kind: "all", state: "all", query: "" };
type Source = { sha256: string; title: string; url: string };
const value = (record: Record<string, unknown>, key: string) => typeof record[key] === "string" ? record[key] as string : "";
let browserClient: SupabaseClient | undefined;
function sourceUrl(url: string) {
  try { const parsed = new URL(url); return parsed.protocol === "https:" ? parsed.href : undefined; } catch { return undefined; }
}
function PrintedRecord({ record }: { record: Record<string, unknown> }) {
  const candidates = Array.isArray(record.candidates) ? record.candidates as Record<string, unknown>[] : [];
  const wording = record.wordingByLanguage as { en?: string; es?: string } | undefined;
  return <>
    {value(record, "printedTitle") && <h3>{value(record, "printedTitle")}</h3>}
    {value(record, "sourceSection") && <p>{value(record, "sourceSection")}</p>}
    {value(record, "voteInstruction") && <p>{value(record, "voteInstruction")}</p>}
    {candidates.length > 0 && <ol>{candidates.map((candidate, index) => <li key={index}>{value(candidate, "printedName")} {value(candidate, "printedParty")}</li>)}</ol>}
    {wording?.en && <><h3>English wording</h3><p className="review-record">{wording.en}</p></>}
    {wording?.es && <><h3>Spanish wording</h3><p className="review-record">{wording.es}</p></>}
    {typeof record.writeInSlot === "boolean" && <p>Printed write-in slot: {record.writeInSlot ? "yes" : "no"}.</p>}
    {value(record, "rawText") && <details><summary>Printed source text</summary><p className="review-record">{value(record, "rawText")}</p></details>}
  </>;
}

export function ReviewQueue() {
  const [client, setClient] = useState<SupabaseClient | null | undefined>(() => process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ? undefined : null);
  const [signedIn, setSignedIn] = useState(false);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [run, setRun] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [mappingStatus, setMappingStatus] = useState<MappingStatus | null>(null);
  const [filters, setFilters] = useState(defaultFilters);
  const [draftFilters, setDraftFilters] = useState(defaultFilters);
  const [matchedTotal, setMatchedTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pageSize = 20;
  useEffect(() => {
    if (client === undefined) {
      browserClient ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, detectSessionInUrl: false } });
      setClient(browserClient);
    }
  }, [client]);
  useEffect(() => {
    const subscription = client?.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") { setSignedIn(false); setTasks([]); setSources([]); setProgress([]); setReadiness(null); setMappingStatus(null); setFilters(defaultFilters); setDraftFilters(defaultFilters); setMatchedTotal(0); setRun(""); }
    });
    return () => subscription?.data.subscription.unsubscribe();
  }, [client]);

  async function load(runId: string, start = 0, selected = defaultFilters) {
    if (!client) return;
    const [queue, documents, totals, summary, drafts] = await Promise.all([
      client.rpc("composition_review_search", { p_run: runId, p_offset: start, p_limit: pageSize, p_kind: selected.kind, p_state: selected.state, p_query: selected.query }),
      client.from("composition_review_tasks").select("payload").eq("run_sha256", runId).eq("kind", "source"),
      client.rpc("composition_review_progress"),
      client.rpc("composition_review_readiness", { p_run: runId }),
      client.from("composition_mapping_drafts").select("sha256").eq("run_sha256", runId).order("created_at", { ascending: false }).limit(1),
    ]);
    if (queue.error || documents.error || totals.error || summary.error || !summary.data || drafts.error) throw new Error("The review queue could not be loaded. Check your reviewer access and try again.");
    const publication = drafts.data.length ? await client.rpc("composition_publication_status", { p_draft: drafts.data[0].sha256 }) : null;
    if (publication?.error) throw new Error("Mapping status could not be loaded. Try again.");
    setRun(runId); setOffset(start); setTasks(queue.data as Task[]);
    setSources(documents.data.map((row) => row.payload as Source)); setProgress(totals.data as Progress[]);
    setReadiness(summary.data as Readiness); setFilters(selected); setDraftFilters(selected); setMatchedTotal(Number(queue.data[0]?.matched_total ?? 0));
    setMappingStatus(publication?.data as MappingStatus | null ?? null);
  }
  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!client) return;
    const form = event.currentTarget; const data = new FormData(form); setBusy(true); setMessage("");
    try {
      const result = await client.auth.signInWithPassword({ email: String(data.get("email")), password: String(data.get("password")) });
      form.reset();
      if (result.error) throw new Error("Sign-in failed. Check your account details.");
      const access = await client.rpc("is_composition_reviewer");
      if (access.error || access.data !== true) { await client.auth.signOut({scope: "local"}); throw new Error("This account does not have reviewer access."); }
      const resultProgress = await client.rpc("composition_review_progress");
      if (resultProgress.error) throw new Error("The review queue is unavailable.");
      setSignedIn(true); setProgress(resultProgress.data as Progress[]);
      if (resultProgress.data.length) await load(resultProgress.data[0].run_sha256);
    } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  }
  async function decide(event: FormEvent<HTMLFormElement>, task: Task) {
    event.preventDefault(); if (!client) return;
    const form = event.currentTarget; const data = new FormData(form); setBusy(true); setMessage("");
    try {
      const result = await client.rpc("decide_composition_task", { p_task_id: task.id, p_decision: String(data.get("decision")), p_note: String(data.get("note")), p_source_hashes: [String(data.get("source"))] });
      if (result.error) throw new Error("The decision could not be saved. Check your access, source selection, and any import blocker.");
      await load(run, filters.state === "all" ? offset : 0, filters); form.reset(); setMessage("Decision saved. Review history is preserved. Publication remains separate.");
    } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  }
  async function changePage(runId: string, start: number, selected = filters) {
    setBusy(true); setMessage("");
    try { await load(runId, start, selected); } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  }
  if (client === undefined) return <p role="status">Loading reviewer sign-in…</p>;
  if (!client) return <div className="fixture-notice"><p>Reviewer sign-in is awaiting a confirmed database connection. Staged records remain in the local review store. Public ballots are unchanged.</p></div>;
  return <>
    <p role="status" aria-live="polite">{message}</p>
    {!signedIn ? <form className="review-form" onSubmit={signIn}>
      <label>Email<input name="email" type="email" autoComplete="username" required /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
      <Button disabled={busy} type="submit">{busy ? "Signing in…" : "Sign in to review"}</Button>
      <p>Use a provisioned reviewer account. This page does not create accounts.</p>
    </form> : <>
      <Button variant="outline" disabled={busy} onClick={async () => { await client.auth.signOut({scope: "local"}); setMessage("Signed out."); }}>Sign out</Button>
      <ResearchPreview client={client} />
      {progress.length === 0 ? <p>No imports have been staged in this project. Import the archived county records to begin review.</p> : <>
        <label className="review-form">Import<select aria-label="Import" value={run} disabled={busy} onChange={(e) => void changePage(e.target.value, 0, defaultFilters)}>
          {progress.map((p) => <option key={p.run_sha256} value={p.run_sha256}>{p.county === "travis" ? "Travis" : "Harris"} · {p.open} open tasks · {p.run_sha256.slice(0, 8)}</option>)}
        </select></label>
        <p>Accepted tasks: {progress.find((p) => p.run_sha256 === run)?.accepted ?? 0}. Every source, record, change, and issue needs a decision. A new import is required to clear extraction or ballot-style blockers.</p>
        {readiness && <ReviewReadiness readiness={readiness} />}
        <CompositionMappingStatus status={mappingStatus} />
        <form className="review-form" aria-label="Filter review tasks" onSubmit={(event) => {
          event.preventDefault(); const data = new FormData(event.currentTarget);
          void changePage(run, 0, { kind: String(data.get("kind")), state: String(data.get("state")), query: String(data.get("query")).trim() });
        }}>
          <label>Task type<select aria-label="Task type" name="kind" value={draftFilters.kind} onChange={(event) => setDraftFilters({ ...draftFilters, kind: event.target.value })} disabled={busy}>
            <option value="all">All task types</option>{Object.entries(reviewKinds).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}
          </select></label>
          <label>Review status<select aria-label="Review status" name="state" value={draftFilters.state} onChange={(event) => setDraftFilters({ ...draftFilters, state: event.target.value })} disabled={busy}>
            <option value="all">All statuses</option><option value="open">All open tasks</option><option value="reviewable">Open tasks ready for review</option>
            <option value="unreviewed">No decision yet</option><option value="accepted">Accepted</option><option value="needs_source">Needs more evidence</option>
            <option value="rejected">Rejected</option><option value="blocked">Requires a new import</option>
          </select></label>
          <label>Search tasks<input name="query" type="search" maxLength={200} value={draftFilters.query} onChange={(event) => setDraftFilters({ ...draftFilters, query: event.target.value })} disabled={busy} placeholder="Office, candidate, source, or review note" /></label>
          <div className="official-source-links"><Button type="submit" disabled={busy}>Apply filters</Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => void changePage(run, 0, defaultFilters)}>Clear filters</Button></div>
        </form>
        <p role="status" aria-live="polite">{matchedTotal === 0 ? "No tasks match these filters. Clear the filters to see all tasks." : `Showing ${offset + 1} to ${offset + tasks.length} of ${matchedTotal} matching tasks.`}</p>
        {tasks.map((task) => <section className="official-document" key={task.id}>
          <div className="eyebrow">{task.kind.replaceAll("_", " ")}</div>
          <h2>{value(task.payload, "printedTitle") || value(task.payload, "title") || value(task.payload, "printedScope") || value(task.payload, "printedOffice") || value(task.payload, "message") || "Import change"}</h2>
          {value(task.payload, "printedName") && <p>{value(task.payload, "printedName")}</p>}
          {value(task.payload, "sourceSheet") ? <p>Worksheet: {value(task.payload, "sourceSheet")}, row {String(task.payload.sourceRow)}.</p> : typeof task.payload.sourcePage === "number" && <p>Source page {task.payload.sourcePage}{typeof task.payload.sourceColumn === "number" ? `, column ${task.payload.sourceColumn}` : ""}.</p>}
          {sourceUrl(value(task.payload, "url")) && <a className="text-link" href={sourceUrl(value(task.payload, "url"))} target="_blank" rel="noreferrer">Open official source (new tab)</a>}
          {task.kind === "record" && <PrintedRecord record={task.payload} />}
          {task.kind === "change" && <>
            <p>Change: {value(task.payload, "change")}.</p>
            <h3>Before</h3>{task.payload.before ? <PrintedRecord record={task.payload.before as Record<string, unknown>} /> : <p>No earlier record.</p>}
            <h3>After</h3>{task.payload.after ? <PrintedRecord record={task.payload.after as Record<string, unknown>} /> : <p>Record removed in this import. The removal requires review.</p>}
          </>}
          {value(task.payload, "matchStatus") && <p>Match result: {value(task.payload, "matchStatus").replaceAll("_", " ")}.</p>}
          {task.last_decision && <details><summary>Latest decision: {task.last_decision.decision.replaceAll("_", " ")}</summary>
            <p>{task.last_decision.note}</p><p>Reviewer {task.last_decision.reviewerId.slice(0, 8)} · {new Intl.DateTimeFormat("en-US", {dateStyle: "medium", timeStyle: "short", timeZone: "America/Chicago"}).format(new Date(task.last_decision.decidedAt))}</p>
          </details>}
          <details><summary>Source references</summary>
            <p>Compare the source document before saving a decision. Unverified machine text requires visual comparison.</p>
            <ul>{sources.filter((source) => !value(task.payload, "sourceSha256") || source.sha256 === value(task.payload, "sourceSha256")).map((source) => <li key={source.sha256}>
              <a href={sourceUrl(source.url)} target="_blank" rel="noreferrer">{source.title} (new tab)</a>
            </li>)}</ul>
          </details>
          {task.requires_new_import && <p>This flag requires a corrected or verified import. A review note cannot clear it.</p>}
          <form className="review-form" onSubmit={(event) => void decide(event, task)}>
            <label>Decision<select aria-label="Decision" name="decision" required disabled={busy}>
              <option value="needs_source">Needs more evidence</option><option value="accepted" disabled={task.requires_new_import}>Reviewed and accepted</option><option value="rejected">Rejected</option>
            </select></label>
            <label>Supporting source<select aria-label="Supporting source" name="source" required disabled={busy} defaultValue={value(task.payload, "sourceSha256") || value(task.payload, "sha256")}>
              <option value="">Choose a source</option>{sources.map((source) => <option key={source.sha256} value={source.sha256}>{source.title}</option>)}
            </select></label>
            <label>Evidence and reason<textarea name="note" minLength={10} required disabled={busy} rows={3} /></label>
            <Button type="submit" disabled={busy}>Save decision</Button>
          </form>
        </section>)}
        <div className="official-source-links">
          <Button variant="outline" disabled={busy || offset === 0} onClick={() => void changePage(run, offset - pageSize)}>Previous tasks</Button>
          <Button variant="outline" disabled={busy || offset + tasks.length >= matchedTotal} onClick={() => void changePage(run, offset + pageSize)}>Next tasks</Button>
        </div>
      </>}
    </>}
  </>;
}

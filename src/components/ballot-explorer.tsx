"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  FileText,
  FlaskConical,
  Info,
  MapPin,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { contestsForStyle, type BallotDataset } from "@/domain/ballot";
import { officeLabels } from "@/domain/office-labels";

export function BallotExplorer({ data }: { data: BallotDataset }) {
  const [city, setCity] = useState<"austin" | "houston">("austin");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All contests");
  const style = data.ballotStyles.find((s) => s.city === city)!;
  const contests = contestsForStyle(data, style.id);
  const groups = [...new Set(contests.map((c) => officeLabels[c.officeType]))];
  const filtered = contests.filter(
    (c) =>
      (category === "All contests" ||
        officeLabels[c.officeType] === category) &&
      `${c.title} ${data.entries
        .filter((e) => e.contestId === c.id)
        .map((e) => e.printedName)
        .join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="eyebrow">
        <span className="eyebrow-line" /> THE NOVEMBER 2026 ELECTION
      </div>
      <section className="page-intro">
        <div>
          <h1>
            Every contest.
            <br />
            <em>A clearer picture.</em>
          </h1>
          <p>
            Your ballot goes beyond the top of the ticket.
            <br className="desktop-break" /> Explore the offices and measures
            that shape your community.
          </p>
        </div>
        <div className="election-stamp">
          <CalendarDays size={21} aria-hidden="true" />
          <span>
            ELECTION DAY<strong>November 3, 2026</strong>
            <small>General & special elections</small>
          </span>
        </div>
      </section>
      <div className="fixture-notice" role="note">
        <FlaskConical size={20} aria-hidden="true" />
        <div>
          <strong>You’re exploring a test ballot.</strong>
          <p>
            Every name, contest assignment, and measure below is synthetic. This
            is not your official ballot.
          </p>
        </div>
        <span className="fixture-tag">TEST FIXTURES</span>
      </div>
      <section
        className="location-bar"
        aria-label="Demonstration ballot selection"
      >
        <div className="location-icon">
          <MapPin size={21} aria-hidden="true" />
        </div>
        <div>
          <label htmlFor="city">Explore a city</label>
          <div className="select-wrap">
            <select
              id="city"
              value={city}
              onChange={(e) => {
                setCity(e.target.value as "austin" | "houston");
                setCategory("All contests");
                setQuery("");
              }}
            >
              <option value="austin">Austin, Texas</option>
              <option value="houston">Houston, Texas</option>
            </select>
            <ChevronDown size={15} aria-hidden="true" />
          </div>
        </div>
        <div className="location-divider" />
        <div className="style-info">
          <span>DEMONSTRATION BALLOT STYLE</span>
          <strong>{style.code}</strong>
        </div>
        <Button asChild variant="outline" className="official-link">
          <Link href="/sources">
            Find your official ballot{" "}
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </Button>
      </section>
      <div className="ballot-columns">
        <div className="ballot-main">
          <section className="ballot-heading">
            <div>
              <div className="section-kicker">THE FULL PICTURE</div>
              <h2>
                Ballot overview <span>{contests.length}</span>
              </h2>
            </div>
            <a href="#contests" className="text-link">
              Explore contests <ArrowDown size={14} aria-hidden="true" />
            </a>
          </section>
          <div className="search-row">
            <Search size={17} aria-hidden="true" />
            <label className="sr-only" htmlFor="contest-search">
              Search contests or example candidates
            </label>
            <input
              id="contest-search"
              type="search"
              placeholder="Search contests or example candidates"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="category-filter">
            <label className="sr-only" htmlFor="category">
              Filter by office group
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option>All contests</option>
              {groups.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
            <span role="status">
              {filtered.length} of {contests.length} contests
            </span>
          </div>
          <div id="contests" className="contest-list">
            {filtered.length === 0 && (
              <div className="empty-state">
                <Search size={24} aria-hidden="true" />
                <h3>No contests match your search.</h3>
                <p>Try another office or example candidate name.</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setQuery("");
                    setCategory("All contests");
                  }}
                >
                  Clear filters
                </Button>
              </div>
            )}
            {filtered.map((contest) => {
              const entries = data.entries
                .filter((e) => e.contestId === contest.id)
                .sort((a, b) => a.ballotOrder - b.ballotOrder);
              const measure = data.measures.find(
                (m) => m.contestId === contest.id,
              );
              return (
                <article key={contest.id} className="contest-card">
                  <details>
                    <summary>
                      <div className="contest-symbol">
                        <FileText size={20} aria-hidden="true" />
                      </div>
                      <div className="contest-title">
                        <div className="contest-category">
                          {officeLabels[contest.officeType]}
                          {contest.electionType === "special" && (
                            <span>Special election</span>
                          )}
                        </div>
                        <h3>{contest.title}</h3>
                        <p>
                          {measure
                            ? "1 example measure · For / Against"
                            : `${entries.length} example candidate${entries.length === 1 ? " · Uncontested fixture" : "s"}`}
                        </p>
                      </div>
                      <span className="research-label">
                        Research not started
                      </span>
                      <ChevronRight
                        className="expand-icon"
                        size={18}
                        aria-hidden="true"
                      />
                    </summary>
                    <div className="contest-content">
                      {contest.officeType === "judicial" && (
                        <p className="judicial-note">
                          Judicial research will focus on qualifications and
                          judicial records. Policy matching is not available for
                          this contest.
                        </p>
                      )}
                      {measure ? (
                        <>
                          <h4>Test proposition wording</h4>
                          <p>{measure.exactWording}</p>
                          <p className="muted">
                            Example options:{" "}
                            {measure.responseOptions.join(" / ")}
                          </p>
                        </>
                      ) : (
                        <ul className="candidate-list">
                          {entries.map((entry) => (
                            <li key={entry.id}>
                              <span
                                className="candidate-initial"
                                aria-hidden="true"
                              >
                                {entry.printedName.slice(-3)}
                              </span>
                              <div>
                                <strong>{entry.printedName}</strong>
                                <span>
                                  {entry.entryType === "qualified_write_in"
                                    ? "Qualified write-in fixture"
                                    : "Printed-name fixture"}{" "}
                                  · No position evidence
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="provenance-line">
                        <FlaskConical size={14} aria-hidden="true" /> Synthetic
                        source: {contest.provenance.sourceDocumentId} ·{" "}
                        {data.version}
                      </div>
                    </div>
                  </details>
                </article>
              );
            })}
          </div>
          <p className="end-note">
            <Info size={15} aria-hidden="true" /> All contests assigned to this
            test style are shown. Official ballot completeness is unknown.
          </p>
        </div>
        <aside className="context-panel" aria-label="Ballot information">
          <section className="status-card">
            <span className="section-kicker">KNOW WHAT YOU’RE SEEING</span>
            <h2>Two kinds of completeness.</h2>
            <div className="status-block">
              <div>
                <span className="status-dot amber" />
                <h3>Ballot verification</h3>
                <span className="status-value">Unverified</span>
              </div>
              <p>
                No address or official ballot style has been verified. City
                selection opens a demonstration only.
              </p>
            </div>
            <div className="status-block">
              <div>
                <span className="status-dot gray" />
                <h3>Candidate research</h3>
                <span className="status-value">0 reviewed</span>
              </div>
              <p>
                Missing research never removes a contest. No candidate positions
                or match scores are published.
              </p>
            </div>
            <Link href="/methodology">
              Read the methodology <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </section>
          <section className="privacy-card">
            <ShieldCheck size={22} aria-hidden="true" />
            <h2>Your perspective stays yours.</h2>
            <p>
              This preview collects no address or political responses. Future
              quiz answers will stay on your device by default.
            </p>
          </section>
          <div className="scope-note">
            <span>MILESTONE 01</span>
            <p>Foundation & ballot models</p>
            <small>
              Live lookup, candidate evidence, and the policy quiz are planned
              for later milestones.
            </small>
          </div>
        </aside>
      </div>
    </>
  );
}

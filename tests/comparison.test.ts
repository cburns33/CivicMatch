import { describe, expect, it } from "vitest";
import { answerStorageKey, compareCandidate, researchPacketSchema, restoreAnswers, type Answers, type Position, type ResearchPacket } from "../src/domain/comparison";
import { governorCandidates, governorQuestions, publishedGovernorResearch } from "../src/data/governor-guide";

const questions = governorQuestions;
const source = { id: "test-only", title: "SYNTHETIC", url: "https://example.test/record", publishedAt: null, retrievedAt: "2026-10-27T12:00:00Z", sha256: "a".repeat(64) };
function packet(count = 7): ResearchPacket {
  return { version: "synthetic-v1", review: { status: "approved", reviewer: "SYNTHETIC", reviewedAt: "2026-10-27T12:00:00Z" }, sources: [source], positions: questions.slice(0, count).map((q) => ({ candidateId: "test", questionId: q.id, value: 4, kind: "recorded_statement", summary: "SYNTHETIC", rationale: "SYNTHETIC", limitations: "SYNTHETIC", confidence: "qualified", sourceIds: [source.id], conflict: false })) };
}
function responses(value = 4): Answers { return Object.fromEntries(questions.map((q) => [q.id, { state: "answered", value, importance: null }])); }

describe("selected-race comparison and coverage", () => {
  it("keeps all three printed candidates and four certified write-ins in source order", () => {
    expect(governorCandidates.map((c) => c.name)).toEqual(["Greg Abbott", "Gina Hinojosa", "Pat Dixon", "Edward Earl Giles", "Jenn Mack", "Jinghpaw Majoishingra", "Mike Miller"]);
    expect(governorCandidates.filter((c) => c.writeIn)).toHaveLength(4);
    expect(publishedGovernorResearch.review.status).toBe("provisional");
    expect(researchPacketSchema.safeParse(publishedGovernorResearch).success).toBe(true);
  });
  it("calculates weighted distance and equal-weight sensitivity without evidence multipliers", () => {
    const answers = responses();
    answers[questions[0].id] = { state: "answered", value: 1, importance: 5 };
    answers[questions[1].id].importance = 1;
    const result = compareCandidate("test", questions, answers, packet());
    expect(result.percent).toBeCloseTo(80);
    expect(result.equalPercent).toBeCloseTo(100 * 6.25 / 7);
    expect(result.research).toBe(7);
    expect(result.priorityPercent).toBeNull();
  });
  it("counts neutral while excluding skipped and unanswered questions", () => {
    const answers = responses(3);
    answers[questions[0].id] = { state: "skipped", value: null, importance: 5 };
    answers[questions[1].id] = { state: "unanswered", value: null, importance: 1 };
    expect(compareCandidate("test", questions, answers, packet())).toMatchObject({ answered: 5, comparable: 5, percent: 75, research: 7, coverage: 1 });
  });
  it("does not turn no answers or no research into zero-percent agreement", () => {
    expect(compareCandidate("test", questions, {}, packet())).toMatchObject({ percent: null, answered: 0, coverage: 0 });
    expect(compareCandidate("missing", questions, responses(), packet())).toMatchObject({ percent: null, comparable: 0, research: 0 });
  });
  it("enforces five comparable questions and the coverage gate per candidate", () => {
    expect(compareCandidate("test", questions, responses(), packet(4)).percent).toBeNull();
    expect(compareCandidate("test", questions, responses(), packet(5))).toMatchObject({ percent: 100, comparable: 5, coverage: 5 / 7 });
    const moreQuestions = [...questions, ...[8, 9].map((i) => ({ ...questions[0], id: `extra-${i}` }))];
    const answers = { ...responses(), "extra-8": { state: "answered" as const, value: 4, importance: null }, "extra-9": { state: "answered" as const, value: 4, importance: null } };
    expect(compareCandidate("test", moreQuestions, answers, packet(5)).percent).toBeNull();
  });
  it("excludes unresolved, limited, and missing-source evidence", () => {
    const draft = packet();
    draft.positions[0].conflict = true;
    draft.positions[1].confidence = "limited";
    draft.positions[2].sourceIds = ["missing"];
    expect(compareCandidate("test", questions, responses(), draft)).toMatchObject({ comparable: 4, research: 4, percent: null });
  });
  it("never uses a pending packet for public scores or coverage", () => {
    const draft = packet(); draft.review = { status: "pending", reviewer: null, reviewedAt: null };
    expect(compareCandidate("test", questions, responses(), draft)).toMatchObject({ research: 0, comparable: 0, percent: null });
    expect(compareCandidate("test", questions, responses(), draft, true).percent).toBe(100);
  });
  it("supports explicitly labeled provisional research without claiming human approval", () => {
    const provisional = packet(); provisional.review = { status: "provisional", reviewer: null, reviewedAt: null };
    expect(researchPacketSchema.safeParse(provisional).success).toBe(true);
    expect(compareCandidate("test", questions, responses(), provisional).percent).toBe(100);
    provisional.review.reviewer = "SYNTHETIC";
    expect(researchPacketSchema.safeParse(provisional).success).toBe(false);
  });
  it("has five sourced mappings per printed candidate and preserves ambiguous exclusions", () => {
    for (const candidate of governorCandidates.slice(0, 3)) {
      expect(compareCandidate(candidate.id, questions, responses(), publishedGovernorResearch)).toMatchObject({ research: 5, comparable: 5 });
      expect(compareCandidate(candidate.id, questions, responses(), publishedGovernorResearch).percent).not.toBeNull();
    }
    for (const candidate of governorCandidates.slice(3)) expect(compareCandidate(candidate.id, questions, responses(), publishedGovernorResearch).percent).toBeNull();
    for (const [candidateId, questionId] of [["hinojosa", "death-v1"], ["dixon", "abortion-v1"]]) expect(publishedGovernorResearch.positions.find((p) => p.candidateId === candidateId && p.questionId === questionId)?.value).toBeNull();
    expect(publishedGovernorResearch.review).toEqual({ status: "provisional", reviewer: null, reviewedAt: null });
  });
  it("gates the high-priority subset and shows weighted coverage separately", () => {
    const answers = responses();
    for (const q of questions.slice(0, 5)) answers[q.id].importance = 5;
    const result = compareCandidate("test", questions, answers, packet(5));
    expect(result.priorityPercent).toBe(100);
    expect(result.weightedCoverage).toBeCloseTo(10 / 12);
    expect(result.coverage).toBe(5 / 7);
  });
  it("rejects missing review attribution, duplicate mappings, motives, conflicts, and source gaps", () => {
    expect(researchPacketSchema.safeParse(packet()).success).toBe(true);
    const mutations: ((p: ResearchPacket) => void)[] = [
      (p) => { p.review.reviewer = null; },
      (p) => { p.positions.push(p.positions[0]); },
      (p) => { p.positions[0].kind = "inferred_motive" as Position["kind"]; },
      (p) => { p.positions[0].conflict = true; },
      (p) => { p.positions[0].sourceIds = ["missing"]; },
      (p) => { p.positions[0].value = 0; },
    ];
    for (const mutate of mutations) { const p = packet(); mutate(p); expect(researchPacketSchema.safeParse(p).success).toBe(false); }
  });
  it("restores only validated current question revisions and handles corrupt storage", () => {
    expect(answerStorageKey).toContain("v1");
    expect(restoreAnswers("not JSON", questions)).toEqual({});
    const answers = responses();
    answers[questions[0].id] = { state: "skipped", value: 3, importance: null };
    const restored = restoreAnswers(JSON.stringify({ version: 1, answers: { ...answers, oldQuestion: { state: "answered", value: 5, importance: 2 } } }), questions);
    expect(Object.keys(restored)).toHaveLength(6);
    expect(restored[questions[0].id]).toBeUndefined();
    expect(restored.oldQuestion).toBeUndefined();
    expect(restoreAnswers(JSON.stringify({ version: 2, answers: responses() }), questions)).toEqual({});
  });
});

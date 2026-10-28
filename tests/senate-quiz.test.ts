import { describe, expect, it } from "vitest";
import { compareCandidate, researchPacketSchema, type Answers } from "../src/domain/comparison";
import { availableQuizRaces, quizIssues } from "../src/data/issue-quiz";
import { senateCandidates, senateQuestions, publishedSenateResearch } from "../src/data/senate-guide";

const allAnswers: Answers = Object.fromEntries(availableQuizRaces.flatMap((race) => race.questions).map((question) => [question.id, { state: "answered", value: 4, importance: null }]));
describe("Senate coverage in the shared issue quiz", () => {
  it("includes the three printed candidates and four state-certified write-ins", () => {
    expect(senateCandidates.map((candidate) => candidate.name)).toEqual(["Ken Paxton", "James Talarico", "Ted Brown", "Avery Ayers", 'Bradford "Brad" Hall', "Zul Mohamed", "Jade Simmons"]);
    expect(senateCandidates.filter((candidate) => candidate.writeIn)).toHaveLength(4);
    expect(senateCandidates.filter((candidate) => candidate.writeIn).every((candidate) => candidate.party === null)).toBe(true);
  });
  it("assigns every current question to exactly one issue and keeps revision IDs distinct", () => {
    const questions = availableQuizRaces.flatMap((race) => race.questions);
    const issueIds = quizIssues.flatMap((issue) => issue.questionIds);
    expect(questions).toHaveLength(14); expect(quizIssues).toHaveLength(5);
    expect(new Set(questions.map((question) => question.id)).size).toBe(14);
    expect(issueIds.slice().sort()).toEqual(questions.map((question) => question.id).sort());
    expect(availableQuizRaces.reduce((sum, race) => sum + race.candidates.length, 0)).toBe(14);
  });
  it("validates the provisional packet and its current roster/question references", () => {
    expect(researchPacketSchema.safeParse(publishedSenateResearch).success).toBe(true);
    expect(publishedSenateResearch.review).toEqual({ status: "provisional", reviewer: null, reviewedAt: null });
    for (const position of publishedSenateResearch.positions) {
      expect(senateCandidates.some((candidate) => candidate.id === position.candidateId)).toBe(true);
      expect(senateQuestions.some((question) => question.id === position.questionId)).toBe(true);
    }
    expect(publishedSenateResearch.positions.filter((position) => position.value !== null)).toHaveLength(18);
  });
  it("uses only office-applicable answers when all fourteen questions are answered", () => {
    const expected = [{ id: "paxton", comparable: 5, percent: 70 }, { id: "talarico", comparable: 6, percent: 100 * 5.5 / 6 }, { id: "brown", comparable: 5, percent: 60 }];
    for (const candidate of expected) {
      const result = compareCandidate(candidate.id, senateQuestions, allAnswers, publishedSenateResearch);
      expect(result.answered).toBe(7); expect(result.comparable).toBe(candidate.comparable);
      expect(result.percent).toBeCloseTo(candidate.percent);
      const changedGovernor = { ...allAnswers, "vouchers-v1": { state: "answered" as const, value: 1, importance: 5 } };
      expect(compareCandidate(candidate.id, senateQuestions, changedGovernor, publishedSenateResearch)).toEqual(result);
    }
  });
  it("retains sparse and specific write-in evidence without fabricating neutral positions", () => {
    expect(compareCandidate("brad-hall", senateQuestions, allAnswers, publishedSenateResearch)).toMatchObject({ research: 2, comparable: 2, percent: null });
    for (const id of ["ayers", "mohamed", "simmons"]) expect(compareCandidate(id, senateQuestions, allAnswers, publishedSenateResearch)).toMatchObject({ research: 0, percent: null });
    expect(publishedSenateResearch.positions.filter((position) => position.confidence === "limited").every((position) => position.value === null)).toBe(true);
    expect(publishedSenateResearch.positions.some((position) => position.value === 3)).toBe(false);
  });
});

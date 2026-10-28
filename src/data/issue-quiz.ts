import type { QuizIssue, QuizRace } from "@/domain/comparison";
import { governorCandidates, governorQuestions, publishedGovernorResearch } from "./governor-guide";
import { senateCandidates, senateQuestions, publishedSenateResearch } from "./senate-guide";

export const quizIssues: QuizIssue[] = [
  { id: "economy", title: "Economy and housing", description: "Taxes, the cost of housing, and international trade.", questionIds: ["tax-v1", "housing-v1", "us-tariffs-v1"] },
  { id: "health", title: "Health and family", description: "Health coverage and time to care for your family.", questionIds: ["us-aca-v1", "us-leave-v1"] },
  { id: "freedom", title: "Rights and personal freedom", description: "Reproductive choices and cannabis policy at state and federal levels.", questionIds: ["abortion-v1", "us-abortion-v1", "cannabis-v1", "us-cannabis-v1"] },
  { id: "education", title: "Education", description: "School funding and how schools are held accountable.", questionIds: ["vouchers-v1", "testing-v1"] },
  { id: "safety", title: "Safety and immigration", description: "Capital punishment, gun checks, and border barriers.", questionIds: ["death-v1", "us-guns-v1", "us-border-v1"] },
];

export const governorQuizRace: QuizRace = { id: "governor", title: "Texas Governor", candidates: governorCandidates, questions: governorQuestions, research: publishedGovernorResearch };
export const senateQuizRace: QuizRace = { id: "senate", title: "U.S. Senate", candidates: senateCandidates, questions: senateQuestions, research: publishedSenateResearch };
export const availableQuizRaces = [governorQuizRace, senateQuizRace];

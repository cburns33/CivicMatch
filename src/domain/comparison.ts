import { z } from "zod";
import { proposedScoringMethod } from "./quiz";

export const answerSchema = z.object({
  state: z.enum(["answered", "skipped", "unanswered"]),
  value: z.number().int().min(1).max(5).nullable(),
  importance: z.number().int().min(1).max(5).nullable(),
}).refine((answer) => (answer.state === "answered") === (answer.value !== null));
export type Answer = z.infer<typeof answerSchema>;
export type Answers = Record<string, Answer>;
export type Question = { id: string; topic: string; statement: string; context: string };
export type Candidate = { id: string; name: string; party: string | null; writeIn: boolean; website: string | null };
export type Position = {
  candidateId: string; questionId: string; value: number | null;
  kind: "documented_action" | "recorded_statement";
  summary: string; rationale: string; limitations: string;
  confidence: "qualified" | "limited"; sourceIds: string[];
  conflict: boolean;
};
export type ResearchSource = {
  id: string; title: string; url: string; publishedAt: string | null;
  sha256: string; retrievedAt: string;
};
export type ResearchPacket = {
  version: string; review: { status: "pending" | "provisional" | "approved"; reviewer: string | null; reviewedAt: string | null };
  positions: Position[]; sources: ResearchSource[];
};
export type QuizRace = { id: string; title: string; candidates: Candidate[]; questions: Question[]; research: ResearchPacket };
export type QuizIssue = { id: string; title: string; description: string; questionIds: string[] };
export const unifiedAnswerStorageKey = "civicmatch:issue-quiz-v1";

export const researchPacketSchema: z.ZodType<ResearchPacket> = z.object({
  version: z.string().min(1).max(100),
  review: z.object({ status: z.enum(["pending", "provisional", "approved"]), reviewer: z.string().min(1).nullable(), reviewedAt: z.iso.datetime().nullable() }).strict(),
  positions: z.array(z.object({
    candidateId: z.string().min(1), questionId: z.string().min(1), value: z.number().int().min(1).max(5).nullable(),
    kind: z.enum(["documented_action", "recorded_statement"]),
    summary: z.string().min(1), rationale: z.string().min(1), limitations: z.string().min(1),
    confidence: z.enum(["qualified", "limited"]), sourceIds: z.array(z.string().min(1)).min(1), conflict: z.boolean(),
  }).strict()),
  sources: z.array(z.object({
    id: z.string().min(1), title: z.string().min(1), url: z.url().refine((url) => new URL(url).protocol === "https:"),
    publishedAt: z.iso.date().nullable(), sha256: z.string().regex(/^[a-f0-9]{64}$/), retrievedAt: z.iso.datetime(),
  }).strict()),
}).strict().superRefine((packet, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  if (packet.review.status === "approved" && (!packet.review.reviewer || !packet.review.reviewedAt)) issue("Human review attribution and date required.");
  if (packet.review.status !== "approved" && (packet.review.reviewer !== null || packet.review.reviewedAt !== null)) issue("Provisional and pending packets cannot claim human review.");
  if (new Set(packet.sources.map((s) => s.id)).size !== packet.sources.length) issue("Source IDs must be unique.");
  if (new Set(packet.positions.map((p) => `${p.candidateId}:${p.questionId}`)).size !== packet.positions.length) issue("One resolved mapping per candidate and question required.");
  for (const position of packet.positions) {
    if (position.sourceIds.some((id) => !packet.sources.some((source) => source.id === id))) issue("Mapping source is missing.");
    if (position.value !== null && (position.conflict || position.confidence === "limited")) issue("Unresolved or limited evidence cannot have a numeric mapping.");
  }
});

export const blankAnswer: Answer = { state: "unanswered", value: null, importance: null };
export const answerLabels = ["Strongly disagree", "Disagree", "Neither agree nor disagree", "Agree", "Strongly agree"];
export const importanceLabels = ["Least important", "Less important", "Average importance", "More important", "Most important"];
export const answerStorageKey = "civicmatch:governor-questions-v1";

export function restoreAnswers(raw: string | null, questions: Question[]): Answers {
  if (!raw) return {};
  try {
    const stored = JSON.parse(raw);
    if (stored.version !== 1 || typeof stored.answers !== "object" || !stored.answers) return {};
    return Object.fromEntries(questions.flatMap((question) => {
      const parsed = answerSchema.safeParse(stored.answers[question.id]);
      return parsed.success ? [[question.id, parsed.data]] : [];
    }));
  } catch { return {}; }
}

// Pending drafts require the authenticated preview. The small-group release
// accepts labeled provisional mappings without implying human approval.
export function compareCandidate(candidateId: string, questions: Question[], answers: Answers, packet: ResearchPacket, preview = false) {
  const eligible = packet.review.status === "approved" || packet.review.status === "provisional" || preview;
  const positions = eligible ? packet.positions.filter((position) => position.candidateId === candidateId && position.value !== null && !position.conflict && position.confidence !== "limited" && position.sourceIds.length > 0 && position.sourceIds.every((id) => packet.sources.some((source) => source.id === id))) : [];
  const answered = questions.filter((question) => answers[question.id]?.state === "answered");
  const comparable = answered.flatMap((question) => {
    const position = positions.find((item) => item.questionId === question.id);
    return position ? [{ question, position, answer: answers[question.id] }] : [];
  });
  const weighted = (subset: typeof comparable, equal = false) => {
    if (!subset.length) return null;
    let numerator = 0, denominator = 0;
    for (const { answer, position } of subset) {
      const weight = equal || answer.importance === null ? 1 : proposedScoringMethod.importanceWeights[answer.importance - 1];
      numerator += (1 - Math.abs(answer.value! - position.value!) / 4) * weight;
      denominator += weight;
    }
    return 100 * numerator / denominator;
  };
  const coverage = answered.length ? comparable.length / answered.length : 0;
  const sufficient = answered.length >= proposedScoringMethod.minimumAnswered && comparable.length >= proposedScoringMethod.minimumComparable && coverage >= proposedScoringMethod.minimumCoverage;
  const priorities = comparable.filter(({ answer }) => (answer.importance ?? 0) >= 4);
  const priorityAnswers = answered.filter((question) => (answers[question.id].importance ?? 0) >= 4);
  const prioritySufficient = priorityAnswers.length >= 5 && priorities.length >= 5 && priorities.length / priorityAnswers.length >= 0.6;
  const totalWeight = answered.reduce((sum, question) => sum + (answers[question.id].importance === null ? 1 : proposedScoringMethod.importanceWeights[answers[question.id].importance! - 1]), 0);
  const includedWeight = comparable.reduce((sum, { answer }) => sum + (answer.importance === null ? 1 : proposedScoringMethod.importanceWeights[answer.importance - 1]), 0);
  return {
    answered: answered.length, comparable: comparable.length, coverage,
    research: questions.filter((question) => positions.some((position) => position.questionId === question.id)).length,
    weightedCoverage: totalWeight ? includedWeight / totalWeight : 0,
    percent: sufficient ? weighted(comparable) : null,
    equalPercent: sufficient ? weighted(comparable, true) : null,
    priorityPercent: prioritySufficient ? weighted(priorities) : null,
    includedQuestions: comparable.map(({ question }) => question.id),
  };
}

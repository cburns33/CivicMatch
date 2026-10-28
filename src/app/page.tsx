import { IssueQuiz } from "@/components/issue-quiz";
import { availableQuizRaces } from "@/data/issue-quiz";
export default function Home() {
  return <IssueQuiz races={availableQuizRaces} />;
}

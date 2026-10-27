import { RaceComparison } from "@/components/race-comparison";
import { publishedGovernorResearch } from "@/data/governor-guide";
export default function Home() {
  return <RaceComparison research={publishedGovernorResearch} />;
}

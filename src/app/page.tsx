import { BallotExplorer } from "@/components/ballot-explorer";
import { fixtureBallots } from "@/data/fixtures";
export default function Home() {
  return <BallotExplorer data={fixtureBallots} />;
}

import { BallotExplorer } from "@/components/ballot-explorer";
import { fixtureBallots } from "@/data/fixtures";

export const metadata = { title: "Sample ballot demo" };
export default function Demo() { return <BallotExplorer data={fixtureBallots} />; }

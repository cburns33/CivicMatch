import type { Contest } from "./ballot";
export const officeLabels: Record<Contest["officeType"], string> = {
  federal: "Federal offices",
  statewide: "State offices",
  state_legislative: "State offices",
  judicial: "Judicial offices",
  county: "County offices",
  city: "City offices",
  school_board: "Schools & districts",
  appraisal_district: "Schools & districts",
  special_district: "Schools & districts",
  proposition: "Ballot measures",
};

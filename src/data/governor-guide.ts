import type { Candidate, Question, ResearchPacket } from "@/domain/comparison";

export const governorCandidates: Candidate[] = [
  { id: "abbott", name: "Greg Abbott", party: "Republican", writeIn: false, website: "https://www.gregabbott.com/policy/" },
  { id: "hinojosa", name: "Gina Hinojosa", party: "Democratic", writeIn: false, website: "https://ginafortexas.com/" },
  { id: "dixon", name: "Pat Dixon", party: "Libertarian", writeIn: false, website: "https://patdixon.org/pat-dixon-for-governor-statements/" },
  { id: "giles", name: "Edward Earl Giles", party: null, writeIn: true, website: null },
  { id: "mack", name: "Jenn Mack", party: null, writeIn: true, website: "https://jennmackforgovernor.com/" },
  { id: "majoishingra", name: "Jinghpaw Majoishingra", party: null, writeIn: true, website: null },
  { id: "miller", name: "Mike Miller", party: null, writeIn: true, website: "https://mikemiller.netlify.app/" },
];

export const governorQuestions: Question[] = [
  { id: "vouchers-v1", topic: "School funding", statement: "Texas should fund education savings accounts that families can use for private school tuition.", context: "This asks about public funding for private education. Program eligibility, funding limits, and oversight can differ." },
  { id: "tax-v1", topic: "Property taxes", statement: "Texas should eliminate school district property taxes on owner-occupied homes and replace the lost school funding with state revenue.", context: "This asks about a specific funding change. Supporting lower taxes alone does not establish a position on this proposal." },
  { id: "housing-v1", topic: "Housing", statement: "Texas should limit how many single-family homes large institutional investors can buy.", context: "Supporters cite competition with homebuyers. Opponents cite property rights and restrictions on sellers. The details of any limit matter." },
  { id: "cannabis-v1", topic: "Cannabis", statement: "Texas should legalize recreational cannabis for adults.", context: "Adult recreational use, medical access, decriminalization, and hemp regulation are separate policies." },
  { id: "abortion-v1", topic: "Abortion", statement: "Texas should allow a pregnant patient to choose an abortion before fetal viability.", context: "This asks about general access before viability. Medical emergencies, later pregnancy, and rape or incest exceptions require separate questions." },
  { id: "death-v1", topic: "Criminal justice", statement: "Texas should abolish the death penalty.", context: "Support for case-by-case clemency or personal opposition to executions does not establish support for legislative repeal." },
  { id: "testing-v1", topic: "School testing", statement: "Texas should end mandatory statewide standardized testing as the basis for school accountability.", context: "Replacing a named test while retaining another mandatory statewide test differs from ending this approach to accountability." },
];

// No candidate mappings become public without an explicit human review of this version.
export const publishedGovernorResearch: ResearchPacket = {
  version: "governor-research-pending", review: { status: "pending", reviewer: null, reviewedAt: null }, positions: [], sources: [],
};

export const rosterSources = {
  printed: "https://www.sos.state.tx.us/elections/forms/2026-ballot-cert.pdf",
  writeIns: "https://www.sos.texas.gov/elections/forms/2026-write-In-ballot-cert.pdf",
};

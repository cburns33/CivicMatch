import { researchPacketSchema, type Candidate, type Question } from "@/domain/comparison";
import senateResearch from "./senate-research.json";

export const senateCandidates: Candidate[] = [
  { id: "paxton", name: "Ken Paxton", party: "Republican", writeIn: false, website: "https://www.kenpaxton.com/issues" },
  { id: "talarico", name: "James Talarico", party: "Democratic", writeIn: false, website: "https://jamestalarico.com/issues/" },
  { id: "brown", name: "Ted Brown", party: "Libertarian", writeIn: false, website: "https://www.tedbrown.org/website/index.html" },
  { id: "ayers", name: "Avery Ayers", party: null, writeIn: true, website: "https://ayers4.us/issues" },
  { id: "brad-hall", name: 'Bradford "Brad" Hall', party: null, writeIn: true, website: "https://senate.deadliftradio.com/positions.html" },
  { id: "mohamed", name: "Zul Mohamed", party: null, writeIn: true, website: "https://zulmohamedfortexas.com/vote-new-america/" },
  { id: "simmons", name: "Jade Simmons", party: null, writeIn: true, website: "https://www.jadesimmonsforsenate.com/faqs" },
];

export const senateQuestions: Question[] = [
  { id: "us-abortion-v1", topic: "Federal abortion protection", statement: "Congress should establish a nationwide right to abortion before fetal viability.", context: "This asks about a federal legal protection. State law, later-pregnancy rules, and particular medical exceptions are separate questions." },
  { id: "us-guns-v1", topic: "Federal gun checks", statement: "Federal law should extend background-check requirements to more private firearm sales.", context: "This asks about expanding checks. A challenge to one agency rule can concern its legal authority as well as the underlying policy; candidate explanations identify that distinction." },
  { id: "us-tariffs-v1", topic: "Trade and tariffs", statement: "The United States should use broad tariffs on imports to protect domestic industry and gain negotiating leverage.", context: "Broad tariffs differ from targeted sanctions or duties on particular products. A candidate's dated support does not establish approval of every later tariff rate." },
  { id: "us-aca-v1", topic: "Health insurance", statement: "Congress should preserve and improve the Affordable Care Act's federal health-insurance coverage framework.", context: "This asks about the ACA framework, rather than a particular subsidy amount or a single-payer system." },
  { id: "us-border-v1", topic: "Border barriers", statement: "Congress should fund additional physical barriers along the U.S.-Mexico border.", context: "This asks about funding further barriers. It does not require a continuous wall, authorize a particular route, or resolve asylum and immigration-status policy." },
  { id: "us-cannabis-v1", topic: "Federal cannabis policy", statement: "Federal law should permit adult recreational cannabis use.", context: "Removing federal prohibition and changing Texas law are separate actions. This question does not prescribe a particular tax or licensing system." },
  { id: "us-leave-v1", topic: "Paid family leave", statement: "Congress should establish a nationwide paid family leave program.", context: "Funding, eligibility, employer duties, and benefit levels can differ. Supporting families alone does not establish support for this policy." },
];

export const publishedSenateResearch = researchPacketSchema.parse(senateResearch);

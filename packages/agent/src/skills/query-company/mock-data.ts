export interface CompanyDetail {
  name: string;
  introduction: string;
  benefits: string;
  workStyle: string;
  website?: string | null;
  leadership?: unknown[];
  products?: unknown[];
  materials?: unknown[];
  interviewProcess?: Array<{ round: number; name: string; description: string }>;
  researchedAt?: string | null;
}

export const mockCompanies: CompanyDetail[] = [
  {
    name: "Atlas Product Studio",
    introduction: "A premium software studio building high-performance SaaS applications with modern tech stacks.",
    benefits: "Flexible hours, MacBooks provided, competitive healthcare, yearly company trip.",
    workStyle: "High autonomy, cross-functional teams, focus on speed and quality.",
    website: "https://atlasstudio.com",
    leadership: [{ name: "Alex Rivera", title: "CEO", bio: "Co-founded Atlas", source_url: "https://atlasstudio.com/team" }],
    products: [{ name: "Atlas Tracker", description: "Project tracking tool", url: "https://atlasstudio.com/tracker" }],
    materials: [{ type: "blog", title: "Building SaaS", url: "https://atlasstudio.com/blog", description: "Our engineering playbook" }],
    interviewProcess: [
      { round: 1, name: "Resume Screening", description: "HR reviews candidate background." },
      { round: 2, name: "Technical Interview", description: "Focussed coding session." },
      { round: 3, name: "System Design", description: "Architecural mapping." },
      { round: 4, name: "Culture Fit & Offer", description: "Leadership talk." }
    ],
    researchedAt: "2026-01-01T00:00:00Z",
  },
  {
    name: "Northstar HR Cloud",
    introduction: "Cloud-native HR platform for scaling enterprises across Southeast Asia.",
    benefits: "Full social insurance, 13th month salary, hybrid support, training budgets.",
    workStyle: "Collaborative, data-driven decisions, customer-first culture.",
    website: "https://northstarhr.com",
    leadership: [],
    products: [],
    materials: [],
    researchedAt: null,
  },
  {
    name: "Signal Recruit",
    introduction: "AI-driven recruiting intelligence service.",
    benefits: "Remote-first budget, stock options, learning allowance, wellness benefits.",
    workStyle: "Asynchronous communication, result-oriented, self-directed working style.",
    website: "https://signalrecruit.ai",
    leadership: [],
    products: [],
    materials: [],
    researchedAt: null,
  },
  {
    name: "Thoughtworks",
    introduction: "A global software consultancy solving complex problems with technology and progressive principles.",
    benefits: "Premium health insurance, learning and development allowance, diverse environment.",
    workStyle: "Agile, pair programming, focus on code quality and engineering excellence.",
    website: "https://thoughtworks.com",
    leadership: [],
    products: [],
    materials: [],
    researchedAt: "2026-01-01T00:00:00Z",
  }
];

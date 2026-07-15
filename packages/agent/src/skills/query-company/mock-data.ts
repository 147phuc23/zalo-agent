export interface CompanyDetail {
  name: string;
  introduction: string;
  benefits: string;
  workStyle: string;
}

export const mockCompanies: CompanyDetail[] = [
  {
    name: "Atlas Product Studio",
    introduction: "A premium software studio building high-performance SaaS applications with modern tech stacks.",
    benefits: "Flexible hours, MacBooks provided, competitive healthcare, yearly company trip.",
    workStyle: "High autonomy, cross-functional teams, focus on speed and quality.",
  },
  {
    name: "Northstar HR Cloud",
    introduction: "Cloud-native HR platform for scaling enterprises across Southeast Asia.",
    benefits: "Full social insurance, 13th month salary, hybrid support, training budgets.",
    workStyle: "Collaborative, data-driven decisions, customer-first culture.",
  },
  {
    name: "Signal Recruit",
    introduction: "AI-driven recruiting intelligence service.",
    benefits: "Remote-first budget, stock options, learning allowance, wellness benefits.",
    workStyle: "Asynchronous communication, result-oriented, self-directed working style.",
  },
  {
    name: "Thoughtworks",
    introduction: "A global software consultancy solving complex problems with technology and progressive principles.",
    benefits: "Premium health insurance, learning and development allowance, diverse environment.",
    workStyle: "Agile, pair programming, focus on code quality and engineering excellence.",
  }
];

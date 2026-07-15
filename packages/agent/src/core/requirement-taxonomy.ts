export const ROLE_VALUES = [
  "frontend engineer",
  "backend engineer",
  "fullstack engineer",
  "ai engineer",
  "devops engineer",
  "data engineer",
  "mobile engineer",
  "qa engineer",
  "product designer",
  "engineering manager",
  "support engineer",
  "recruiter",
] as const;

export type RoleValue = (typeof ROLE_VALUES)[number];

// Reference vocabulary, not a closed enum: the LLM normalizes to this when
// there's a clear match, and passes through its own lowercased term
// otherwise, since job-relevant tech terms change too often for a strict
// enum to stay usable.
export const SKILL_VALUES = [
  "react", "typescript", "next.js", "tailwindcss", "node.js", "nestjs",
  "postgresql", "redis", "python", "llm", "sql", "rag", "graphql", "aws",
  "kubernetes", "terraform", "ci/cd", "spark", "airflow", "react native",
  "swift", "kotlin", "playwright", "cypress", "jest", "figma", "java",
  "azure", "gcp", "powershell", "jenkins", "azure pipelines", "datadog",
  "prometheus", "grafana", "scrum", "kanban", "c#", ".net", "leadership",
  "system design", "agile",
] as const;

export const AVAILABILITY_VALUES = ["immediate", "2_weeks", "1_month", "negotiable"] as const;
export type AvailabilityValue = (typeof AVAILABILITY_VALUES)[number];

export const LANGUAGE_VALUES = ["english", "vietnamese"] as const;
export type LanguageValue = (typeof LANGUAGE_VALUES)[number];

export function isRoleValue(value: string): value is RoleValue {
  return (ROLE_VALUES as readonly string[]).includes(value);
}

export function isAvailabilityValue(value: string): value is AvailabilityValue {
  return (AVAILABILITY_VALUES as readonly string[]).includes(value);
}

export function isLanguageValue(value: string): value is LanguageValue {
  return (LANGUAGE_VALUES as readonly string[]).includes(value);
}

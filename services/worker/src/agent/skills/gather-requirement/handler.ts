import { tool } from "ai";
import { z } from "zod";
import type { CandidateRequirement } from "../../types.js";

export function createGatherRequirementTool() {
  return tool({
    description: "Extract and merge candidate job-search requirements from recent Zalo messages.",
    parameters: z.object({
      messages: z.array(z.string()).min(1),
      existingRequirement: z.record(z.unknown()).optional(),
    }),
    execute: async ({ messages, existingRequirement }) => {
      const text = messages.join("\n").toLowerCase();
      const requirement: CandidateRequirement = {
        ...(existingRequirement as CandidateRequirement | undefined),
      };

      if (/frontend|react|next/.test(text)) requirement.role = "Frontend Engineer";
      if (/backend|node|nestjs|api/.test(text)) requirement.role = "Backend Engineer";
      if (/data|ai|ml|machine learning/.test(text)) requirement.role = "AI Engineer";
      if (/hr|recruit/.test(text)) requirement.role = "Recruiter";

      if (/hcm|sai gon|saigon|ho chi minh/.test(text)) requirement.location = "Ho Chi Minh City";
      if (/ha noi|hanoi|hn/.test(text)) requirement.location = "Ha Noi";
      if (/remote/.test(text)) requirement.workMode = "remote";
      if (/hybrid/.test(text)) requirement.workMode = "hybrid";
      if (/onsite|office/.test(text)) requirement.workMode = "onsite";

      const years = /(\d+)\+?\s*(years|year|nam|năm)/.exec(text);
      if (years) requirement.yearsOfExperience = Number(years[1]);

      const salary = /(\d{2,3})\s*(tr|triệu|m|million)/.exec(text);
      if (salary) {
        requirement.salaryMinVnd = Number(salary[1]) * 1_000_000;
      }

      const skills = ["react", "node", "typescript", "nestjs", "python", "sql", "recruiting"]
        .filter((skill) => text.includes(skill));
      if (skills.length > 0) requirement.skills = Array.from(new Set([...(requirement.skills ?? []), ...skills]));

      if (/english|tiếng anh|ielts/.test(text)) requirement.language = "English";
      if (/immediate|now|ngay/.test(text)) requirement.availability = "immediate";

      const missingFields = ["role", "location", "salaryMinVnd", "yearsOfExperience"]
        .filter((field) => requirement[field as keyof CandidateRequirement] == null);

      return {
        requirement,
        missingFields,
        confidence: missingFields.length <= 1 ? "high" : missingFields.length <= 3 ? "medium" : "low",
      };
    },
  });
}

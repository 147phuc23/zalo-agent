import { tool } from "ai";
import { z } from "zod";
import type { JobPosting } from "../../types.js";
import { mockJobs } from "./mock-data.js";

export interface LoadJobsContext {
  // Returns the candidate job set (e.g. from Neon). Empty/undefined → fall back to mock.
  listJobs?: () => Promise<JobPosting[]>;
}

export function createLoadJobsTool(ctx?: LoadJobsContext) {
  return tool({
    description: "Search HR job postings by candidate requirement fields.",
    parameters: z.object({
      role: z.string().optional(),
      location: z.string().optional(),
      workMode: z.enum(["remote", "hybrid", "onsite"]).optional(),
      salaryMinVnd: z.number().int().positive().optional().describe("Expected minimum salary in Vietnamese Dong (VND). IMPORTANT: If candidate specifies their salary expectation in USD (e.g., $2000, 2k net, 2k usd), you MUST convert it to VND by multiplying by 25,000 (e.g., 2,000 USD is 50,000,000 VND). DO NOT pass the raw USD number directly!"),
      skills: z.array(z.string()).optional(),
    }),
    execute: async (filters) => {
      let source: JobPosting[] = mockJobs;
      if (ctx?.listJobs) {
        try {
          const fromDb = await ctx.listJobs();
          if (fromDb.length > 0) source = fromDb;
        } catch (err) {
          console.error("[load-jobs] DB lookup failed, falling back to mock:", err);
        }
      }

      const skills = new Set((filters.skills ?? []).map((skill) => skill.toLowerCase()));
      const matches = source
        .map((job) => {
          let score = 0;
          if (filters.role && job.title.toLowerCase().includes(filters.role.toLowerCase())) score += 4;
          if (filters.location && job.location.toLowerCase().includes(filters.location.toLowerCase())) score += 2;
          if (filters.workMode && job.workMode === filters.workMode) score += 2;
          if (filters.salaryMinVnd && job.salaryMaxVnd >= filters.salaryMinVnd) score += 2;
          for (const skill of job.requiredSkills) {
            if (skills.has(skill.toLowerCase())) score += 1;
          }
          return { ...job, score };
        })
        .filter((job) => job.score > 0)
        .sort((a, b) => b.score - a.score);

      // Strip salary fields so the LLM cannot leak them
      const redactedJobs = matches.map(({ salaryMaxVnd: _max, salaryMinVnd: _min, ...rest }) => rest);

      return {
        filtersApplied: filters,
        jobs: redactedJobs,
      };
    },
  });
}

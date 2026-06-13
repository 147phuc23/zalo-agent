import { tool } from "ai";
import { z } from "zod";
import { mockJobs } from "./mock-data.js";
export function createLoadJobsTool() {
    return tool({
        description: "Search mocked HR job postings by candidate requirement fields.",
        parameters: z.object({
            role: z.string().optional(),
            location: z.string().optional(),
            workMode: z.enum(["remote", "hybrid", "onsite"]).optional(),
            salaryMinVnd: z.number().int().positive().optional(),
            skills: z.array(z.string()).optional(),
        }),
        execute: async (filters) => {
            const skills = new Set((filters.skills ?? []).map((skill) => skill.toLowerCase()));
            const matches = mockJobs
                .map((job) => {
                let score = 0;
                if (filters.role && job.title.toLowerCase().includes(filters.role.toLowerCase()))
                    score += 4;
                if (filters.location && job.location.toLowerCase().includes(filters.location.toLowerCase()))
                    score += 2;
                if (filters.workMode && job.workMode === filters.workMode)
                    score += 2;
                if (filters.salaryMinVnd && job.salaryMaxVnd >= filters.salaryMinVnd)
                    score += 2;
                for (const skill of job.requiredSkills) {
                    if (skills.has(skill.toLowerCase()))
                        score += 1;
                }
                return { ...job, score };
            })
                .filter((job) => job.score > 0)
                .sort((a, b) => b.score - a.score);
            return {
                filtersApplied: filters,
                jobs: matches,
            };
        },
    });
}

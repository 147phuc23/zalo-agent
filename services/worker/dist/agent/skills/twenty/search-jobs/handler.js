import { tool } from "ai";
import { z } from "zod";
import { getTwentyRecruitingClient } from "../client-singleton.js";
export function createTwentySearchJobsTool() {
    return tool({
        description: "Search and filter Twenty `jobPosting` records (title, location, work mode, salary, skills). Uses recruiting schema fields.",
        parameters: z.object({
            role: z.string().optional(),
            location: z.string().optional(),
            workMode: z.enum(["remote", "hybrid", "onsite"]).optional(),
            salaryMinVnd: z.number().int().positive().optional(),
            skills: z.array(z.string()).optional(),
        }),
        execute: async (filters) => {
            const client = getTwentyRecruitingClient();
            const jobs = await client.searchJobPostings(filters);
            return {
                source: "twenty",
                filtersApplied: filters,
                jobs,
            };
        },
    });
}

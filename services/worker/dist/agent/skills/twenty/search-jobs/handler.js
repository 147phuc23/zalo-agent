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
            salaryMinVnd: z.number().int().positive().optional().describe("Expected minimum salary in Vietnamese Dong (VND). IMPORTANT: If candidate specifies their salary expectation in USD (e.g., $2000, 2k net, 2k usd), you MUST convert it to VND by multiplying by 25,000 (e.g., 2,000 USD is 50,000,000 VND). DO NOT pass the raw USD number directly!"),
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

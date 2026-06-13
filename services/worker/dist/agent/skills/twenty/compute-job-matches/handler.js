import { tool } from "ai";
import { z } from "zod";
import { getTwentyRecruitingClient } from "../client-singleton.js";
export function createTwentyComputeJobMatchesTool() {
    return tool({
        description: "Score Twenty job postings against the candidate profile (skills, preferred roles, salary expectations). Does not write to Twenty.",
        parameters: z.object({
            tenantId: z.string().min(1),
            channel: z.literal("zalo"),
            externalUserId: z.string().min(1),
            limit: z.number().int().positive().max(30).optional(),
        }),
        execute: async (input) => {
            const client = getTwentyRecruitingClient();
            const profile = await client.loadCandidateProfile({
                externalUserId: input.externalUserId,
            });
            const jobs = await client.searchJobPostings({});
            const ranked = await client.computeJobMatchScores({ profile, jobs });
            const limit = input.limit ?? 10;
            return {
                source: "twenty",
                tenantId: input.tenantId,
                externalUserId: input.externalUserId,
                matches: ranked.slice(0, limit),
            };
        },
    });
}

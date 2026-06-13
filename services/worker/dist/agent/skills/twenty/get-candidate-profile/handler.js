import { tool } from "ai";
import { z } from "zod";
import { getTwentyRecruitingClient } from "../client-singleton.js";
export function createTwentyGetCandidateProfileTool() {
    return tool({
        description: "Load candidate profile data from Twenty CRM for a Zalo external user id (maps to Person.externalUserId).",
        parameters: z.object({
            tenantId: z.string().min(1),
            channel: z.literal("zalo"),
            externalUserId: z.string().min(1),
        }),
        execute: async (input) => {
            const client = getTwentyRecruitingClient();
            const profile = await client.loadCandidateProfile({
                externalUserId: input.externalUserId,
            });
            return {
                source: "twenty",
                tenantId: input.tenantId,
                profile,
            };
        },
    });
}

import { tool } from "ai";
import { z } from "zod";
import { getMockCandidateProfile } from "./mock-data.js";
export function createCrmGetCandidateProfileTool() {
    return tool({
        description: "Load a mocked CRM candidate profile by Zalo external user id.",
        parameters: z.object({
            tenantId: z.string().min(1),
            channel: z.literal("zalo"),
            externalUserId: z.string().min(1),
        }),
        execute: async (input) => getMockCandidateProfile(input),
    });
}

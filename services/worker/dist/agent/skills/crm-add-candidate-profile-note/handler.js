import { tool } from "ai";
import { z } from "zod";
import { addMockCandidateProfileNote } from "../crm-get-candidate-profile/mock-data.js";
export function createCrmAddCandidateProfileNoteTool() {
    return tool({
        description: "Append a durable note to a CRM candidate profile in the in-memory store.",
        parameters: z.object({
            tenantId: z.string().min(1),
            channel: z.literal("zalo"),
            externalUserId: z.string().min(1),
            note: z.string().min(1),
            source: z.string().min(1).optional(),
        }),
        execute: async (input) => addMockCandidateProfileNote(input),
    });
}

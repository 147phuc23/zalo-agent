import { tool } from "ai";
import { z } from "zod";
import { updateMockCandidateProfile } from "../crm-get-candidate-profile/mock-data.js";
const candidateProfilePatchSchema = z.object({
    displayName: z.string().min(1).optional(),
    phone: z.string().min(1).optional(),
    email: z.string().email().optional(),
    location: z.string().min(1).optional(),
    yearsOfExperience: z.number().int().nonnegative().optional(),
    currentTitle: z.string().min(1).optional(),
    skills: z.array(z.string().min(1)).optional(),
    preferredRoles: z.array(z.string().min(1)).optional(),
    salaryExpectationVnd: z.number().int().nonnegative().optional(),
    availability: z.string().min(1).optional(),
});
export function createCrmUpdateCandidateProfileTool() {
    return tool({
        description: "Create or update durable CRM candidate profile fields in the in-memory store.",
        parameters: z.object({
            tenantId: z.string().min(1),
            channel: z.literal("zalo"),
            externalUserId: z.string().min(1),
            patch: candidateProfilePatchSchema,
        }),
        execute: async (input) => updateMockCandidateProfile(input),
    });
}

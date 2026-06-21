import { tool } from "ai";
import { z } from "zod";
import { getTwentyRecruitingClient } from "../client-singleton.js";

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

export function createTwentyUpdateCandidateProfileTool() {
  return tool({
    description: "Create or update durable CRM candidate profile fields in Twenty. Call this when the candidate shares new profile facts.",
    parameters: z.object({
      externalUserId: z.string().min(1),
      patch: candidateProfilePatchSchema,
    }),
    execute: async (input) => {
      const client = getTwentyRecruitingClient();
      await client.updateCandidateProfile(input);
      return {
        success: true,
        patchedFields: Object.keys(input.patch),
      };
    },
  });
}

import { tool } from "ai";
import { z } from "zod";
import { updateMockCandidateProfile } from "../crm-get-candidate-profile/mock-data.js";
import type { CandidateProfileContext } from "../crm-get-candidate-profile/handler.js";

const candidateProfilePatchSchema = z.object({
  displayName: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  email: z.string().email().optional(),
  location: z.string().min(1).optional(),
  yearsOfExperience: z.number().nonnegative().optional(),
  currentTitle: z.string().min(1).optional(),
  skills: z.array(z.string().min(1)).optional(),
  preferredRoles: z.array(z.string().min(1)).optional(),
  salaryExpectationVnd: z.number().int().nonnegative().optional(),
  availability: z.string().min(1).optional(),
});

export function createCrmUpdateCandidateProfileTool(ctx?: CandidateProfileContext) {
  return tool({
    description: "Create or update durable CRM candidate profile fields.",
    parameters: z.object({
      tenantId: z.string().min(1),
      channel: z.literal("zalo"),
      externalUserId: z.string().min(1),
      patch: candidateProfilePatchSchema,
    }),
    execute: async (input) => {
      if (ctx?.updateProfile) {
        try {
          const fromDb = await ctx.updateProfile(input);
          if (fromDb) return fromDb;
        } catch (err) {
          console.error("[crm-update-candidate-profile] DB update failed, falling back to mock:", err);
        }
      }
      return updateMockCandidateProfile(input);
    },
  });
}

import { tool } from "ai";
import { z } from "zod";
import { getMockCandidateProfile } from "./mock-data.js";

export interface CandidateProfileContext {
  getProfile?: (input: { tenantId: string; channel: string; externalUserId: string }) => Promise<any>;
  updateProfile?: (input: { tenantId: string; channel: string; externalUserId: string; patch: any }) => Promise<any>;
  addNote?: (input: { tenantId: string; channel: string; externalUserId: string; note: string; source?: string }) => Promise<any>;
}

export function createCrmGetCandidateProfileTool(ctx?: CandidateProfileContext) {
  return tool({
    description: "Load a candidate profile from the CRM by Zalo external user id.",
    parameters: z.object({
      tenantId: z.string().min(1),
      channel: z.literal("zalo"),
      externalUserId: z.string().min(1),
    }),
    execute: async (input) => {
      if (ctx?.getProfile) {
        try {
          const fromDb = await ctx.getProfile(input);
          if (fromDb) return fromDb;
        } catch (err) {
          console.error("[crm-get-candidate-profile] DB lookup failed, falling back to mock:", err);
        }
      }
      return getMockCandidateProfile(input);
    },
  });
}

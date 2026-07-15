import { tool } from "ai";
import { z } from "zod";
import { addMockCandidateProfileNote } from "../crm-get-candidate-profile/mock-data.js";
import type { CandidateProfileContext } from "../crm-get-candidate-profile/handler.js";

export function createCrmAddCandidateProfileNoteTool(ctx?: CandidateProfileContext) {
  return tool({
    description: "Append a note to a CRM candidate profile.",
    parameters: z.object({
      tenantId: z.string().min(1),
      channel: z.literal("zalo"),
      externalUserId: z.string().min(1),
      note: z.string().min(1),
      source: z.string().min(1).optional(),
    }),
    execute: async (input) => {
      if (ctx?.addNote) {
        try {
          const fromDb = await ctx.addNote(input);
          if (fromDb) return fromDb;
        } catch (err) {
          console.error("[crm-add-candidate-profile-note] DB add note failed, falling back to mock:", err);
        }
      }
      return addMockCandidateProfileNote(input);
    },
  });
}

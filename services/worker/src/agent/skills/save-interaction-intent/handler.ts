import { tool } from "ai";
import { z } from "zod";
import { saveIntent } from "../../mock/store.js";

export function createSaveInteractionIntentTool() {
  return tool({
    description: "Save the current candidate intent and requirement snapshot in memory.",
    parameters: z.object({
      tenantId: z.string().min(1),
      threadId: z.string().min(1),
      intent: z.string().min(1),
      requirement: z.record(z.unknown()).default({}),
    }),
    execute: async (input) => saveIntent(input),
  });
}

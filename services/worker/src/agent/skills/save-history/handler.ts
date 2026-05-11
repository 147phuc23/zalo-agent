import { tool } from "ai";
import { z } from "zod";
import { saveHistory } from "../../mock/store.js";

export function createSaveHistoryTool() {
  return tool({
    description: "Save chat or tool history into the in-memory store.",
    parameters: z.object({
      tenantId: z.string().min(1),
      threadId: z.string().min(1),
      entries: z.array(z.object({
        role: z.enum(["user", "assistant", "tool"]),
        content: z.string(),
        createdAt: z.string(),
        metadata: z.record(z.unknown()).optional(),
      })).min(1),
    }),
    execute: async (input) => saveHistory(input),
  });
}

import { tool } from "ai";
import { z } from "zod";

export interface RecordKnowledgeGapContext {
  recordGap?: (input: {
    question: string;
    companyName?: string;
    topic?: "company" | "job" | "process" | "benefits" | "other";
  }) => Promise<{ id: string; duplicate: boolean }>;
}

export function createRecordKnowledgeGapTool(ctx?: RecordKnowledgeGapContext) {
  return tool({
    description: "Record a candidate question as an open knowledge gap when information is missing or unresearched.",
    parameters: z.object({
      question: z.string().describe("The candidate's question that could not be answered."),
      companyName: z.string().optional().describe("Optional company name associated with the question."),
      topic: z.enum(["company", "job", "process", "benefits", "other"]).optional().describe("Optional classification of the question topic."),
    }),
    execute: async ({ question, companyName, topic }) => {
      if (ctx?.recordGap) {
        try {
          const res = await ctx.recordGap({ question, companyName, topic });
          return res;
        } catch (err: any) {
          console.error("[record-knowledge-gap] failed:", err);
          return {
            error: err.message || String(err),
          };
        }
      }

      // Mock fallback
      return {
        id: "mock-gap-id-123",
        duplicate: false,
      };
    },
  });
}

import { tool } from "ai";
import { z } from "zod";

export interface SubmitApplicationContext {
  submit?: (input: { jobId: string; note?: string }) => Promise<{
    applicationId: string;
    created: boolean;
    jobTitle: string;
    companyName: string;
  }>;
}

export function createSubmitApplicationTool(ctx?: SubmitApplicationContext) {
  return tool({
    description: "Submit a job application for the candidate to a specific active job posting. Use only after candidate confirms.",
    parameters: z.object({
      jobId: z.string().describe("Database ID or external ID of the job posting to apply to."),
      note: z.string().optional().describe("Optional cover note or comment from the candidate."),
    }),
    execute: async ({ jobId, note }) => {
      if (ctx?.submit) {
        try {
          const res = await ctx.submit({ jobId, note });
          return res;
        } catch (err: any) {
          console.error("[submit-application] DB submit failed:", err);
          return {
            error: err.message || String(err),
          };
        }
      }

      // Mock fallback
      return {
        applicationId: "mock-app-id-123",
        created: true,
        jobTitle: "NodeJS Developer (Mock)",
        companyName: "Company X (Mock)",
      };
    },
  });
}

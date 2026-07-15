import { tool } from "ai";
import { z } from "zod";

export interface GetApplicationStatusContext {
  getStatus?: () => Promise<Array<{
    jobTitle: string;
    companyName: string;
    stage: string;
    status: string;
    updatedAt: string;
    lastNote: string | null;
  }>>;
}

export function createGetApplicationStatusTool(ctx?: GetApplicationStatusContext) {
  return tool({
    description: "Get the status and pipeline stage of the candidate's active job applications.",
    parameters: z.object({}),
    execute: async () => {
      if (ctx?.getStatus) {
        try {
          const res = await ctx.getStatus();
          return res;
        } catch (err: any) {
          console.error("[get-application-status] DB getStatus failed:", err);
          return {
            error: err.message || String(err),
          };
        }
      }

      // Mock fallback
      return [
        {
          jobTitle: "NodeJS Developer (Mock)",
          companyName: "Company X (Mock)",
          stage: "interviewing",
          status: "active",
          updatedAt: new Date().toISOString(),
          lastNote: "Phỏng vấn vòng 1 tốt (Mock note)",
        },
      ];
    },
  });
}

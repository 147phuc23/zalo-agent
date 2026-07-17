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
    interviewProcess?: Array<{ round: number; name: string; description: string }>;
    timelineEvents?: Array<{
      fromStage: string | null;
      toStage: string;
      fromStatus: string | null;
      toStatus: string;
      actorType: string;
      note: string | null;
      createdAt: string;
    }>;
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
          interviewProcess: [
            { round: 1, name: "Screening", description: "Initial CV review" },
            { round: 2, name: "Technical Interview", description: "Algorithm and JS coding session" }
          ],
          timelineEvents: [
            {
              fromStage: null,
              toStage: "submitted",
              fromStatus: null,
              toStatus: "active",
              actorType: "candidate",
              note: "Applied via Zalo recruiter bot",
              createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString() // 3 days ago
            },
            {
              fromStage: "submitted",
              toStage: "interviewing",
              fromStatus: "active",
              toStatus: "active",
              actorType: "admin",
              note: "Moved to interview after CV review",
              createdAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString() // 1 day ago
            }
          ]
        },
      ];
    },
  });
}

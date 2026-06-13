import { tool } from "ai";
import { z } from "zod";
import { IN_PROGRESS_APPLICATION_STAGES } from "../../../twenty/recruiting-client.js";
import { getTwentyRecruitingClient } from "../client-singleton.js";
export function createTwentyListInProgressApplicationsTool() {
    return tool({
        description: "List active job applications for a candidate from Twenty `jobApplication` records (stages: applied, screening, interview). Joins `jobPosting` details when present.",
        parameters: z.object({
            tenantId: z.string().min(1),
            channel: z.literal("zalo"),
            externalUserId: z.string().min(1),
        }),
        execute: async (input) => {
            const client = getTwentyRecruitingClient();
            const applications = await client.listInProgressApplications({
                externalUserId: input.externalUserId,
            });
            return {
                source: "twenty",
                tenantId: input.tenantId,
                externalUserId: input.externalUserId,
                inProgressStages: [...IN_PROGRESS_APPLICATION_STAGES],
                applications,
            };
        },
    });
}

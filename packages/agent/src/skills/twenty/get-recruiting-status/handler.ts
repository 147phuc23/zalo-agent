import { tool } from "ai";
import { z } from "zod";
import { getTwentyRecruitingClient } from "../client-singleton.js";

export function createTwentyGetRecruitingStatusTool() {
  return tool({
    description:
      "Read recruiting pipeline stage stored on Twenty Person (`recruitingPipelineStage`) for a Zalo external user id.",
    parameters: z.object({
      tenantId: z.string().min(1),
      channel: z.literal("zalo"),
      externalUserId: z.string().min(1),
    }),
    execute: async (input) => {
      const client = getTwentyRecruitingClient();
      const status = await client.getCandidateRecruitingStatus({
        externalUserId: input.externalUserId,
      });

      return {
        source: "twenty",
        tenantId: input.tenantId,
        externalUserId: input.externalUserId,
        ...status,
      };
    },
  });
}

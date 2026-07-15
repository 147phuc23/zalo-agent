import { describe, expect, it } from "vitest";
import { createTwentyAgentTools } from "./registry.js";

describe("createTwentyAgentTools", () => {
  it("registers Twenty-backed tool names", () => {
    const tools = createTwentyAgentTools([]);
    expect(Object.keys(tools).sort()).toEqual(
      [
        "hr_gatherRequirement",
        "hr_normalizeRequirement",
        "memory_saveInteractionIntent",
        "skills_load",
        "skills_search",
        "twenty_computeJobMatches",
        "twenty_getCandidateProfile",
        "twenty_getJobFilters",
        "twenty_getRecruitingStatus",
        "twenty_listInProgressApplications",
        "twenty_searchJobs",
        "twenty_updateCandidateProfile",
      ].sort(),
    );
  });
});

import { createTwentyComputeJobMatchesTool } from "./compute-job-matches/handler.js";
import { createTwentyGetCandidateProfileTool } from "./get-candidate-profile/handler.js";
import { createTwentyGetRecruitingStatusTool } from "./get-recruiting-status/handler.js";
import { createTwentyListInProgressApplicationsTool } from "./list-in-progress-applications/handler.js";
import { createTwentySearchJobsTool } from "./search-jobs/handler.js";
import { createTwentyUpdateCandidateProfileTool } from "./update-candidate-profile/handler.js";
import { createTwentySkillLoadTool, createTwentySkillSearchTool } from "./skills-meta/handler.js";
import { createGatherRequirementTool } from "../gather-requirement/handler.js";
import { createSaveHistoryTool } from "../save-history/handler.js";
import { createSaveInteractionIntentTool } from "../save-interaction-intent/handler.js";
export function createTwentyAgentTools(skills) {
    return {
        skills_search: createTwentySkillSearchTool(skills),
        skills_load: createTwentySkillLoadTool(skills),
        twenty_getCandidateProfile: createTwentyGetCandidateProfileTool(),
        twenty_updateCandidateProfile: createTwentyUpdateCandidateProfileTool(),
        twenty_searchJobs: createTwentySearchJobsTool(),
        twenty_getRecruitingStatus: createTwentyGetRecruitingStatusTool(),
        twenty_listInProgressApplications: createTwentyListInProgressApplicationsTool(),
        twenty_computeJobMatches: createTwentyComputeJobMatchesTool(),
        hr_gatherRequirement: createGatherRequirementTool(),
        history_saveMessage: createSaveHistoryTool(),
        memory_saveInteractionIntent: createSaveInteractionIntentTool(),
    };
}

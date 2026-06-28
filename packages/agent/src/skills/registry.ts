import { tool } from "ai";
import { z } from "zod";
import type { SkillDefinition } from "../types.js";
import { createCrmAddCandidateProfileNoteTool } from "./crm-add-candidate-profile-note/handler.js";
import { createCrmGetCandidateProfileTool } from "./crm-get-candidate-profile/handler.js";
import { createCrmUpdateCandidateProfileTool } from "./crm-update-candidate-profile/handler.js";
import { createGatherRequirementTool } from "./gather-requirement/handler.js";
import { createLoadJobsTool, type LoadJobsContext } from "./load-jobs/handler.js";
import { createSaveHistoryTool } from "./save-history/handler.js";
import { createSaveInteractionIntentTool } from "./save-interaction-intent/handler.js";

export interface AgentToolsContext {
  loadJobs?: LoadJobsContext;
}

export function createAgentTools(skills: SkillDefinition[], ctx?: AgentToolsContext) {
  return {
    skills_search: createSkillSearchTool(skills),
    skills_load: createSkillLoadTool(skills),
    crm_getCandidateProfile: createCrmGetCandidateProfileTool(),
    crm_updateCandidateProfile: createCrmUpdateCandidateProfileTool(),
    crm_addCandidateProfileNote: createCrmAddCandidateProfileNoteTool(),
    hr_gatherRequirement: createGatherRequirementTool(),
    history_saveMessage: createSaveHistoryTool(),
    memory_saveInteractionIntent: createSaveInteractionIntentTool(),
    jobs_search: createLoadJobsTool(ctx?.loadJobs),
  };
}

function createSkillSearchTool(skills: SkillDefinition[]) {
  return tool({
    description: "Default skill discovery tool. Search available HR agent skills by text query before loading skill docs or calling business skills.",
    parameters: z.object({
      query: z.string().min(1),
    }),
    execute: async ({ query }) => {
      const queryTerms = query.toLowerCase().split(/\W+/).filter(Boolean);
      return {
        skills: skills
          .map((skill) => {
            const haystack = `${skill.id} ${skill.name} ${skill.description}`.toLowerCase();
            const score = queryTerms.filter((term) => haystack.includes(term)).length;
            return { skill, score };
          })
          .filter((entry) => entry.score > 0)
          .sort((a, b) => b.score - a.score || a.skill.id.localeCompare(b.skill.id))
          .map(({ skill, score }) => ({
            id: skill.id,
            name: skill.name,
            description: skill.description,
            score,
          })),
      };
    },
  });
}

function createSkillLoadTool(skills: SkillDefinition[]) {
  return tool({
    description: "Load full Markdown instructions for one or more HR agent skills.",
    parameters: z.object({
      skillIds: z.array(z.string().min(1)).min(1),
    }),
    execute: async ({ skillIds }) => {
      const byId = new Map(skills.map((skill) => [skill.id, skill]));
      return {
        skills: skillIds
          .map((skillId) => byId.get(skillId))
          .filter(Boolean)
          .map((skill) => ({
            id: skill!.id,
            name: skill!.name,
            content: skill!.content,
          })),
      };
    },
  });
}

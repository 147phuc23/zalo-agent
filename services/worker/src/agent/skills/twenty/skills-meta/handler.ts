import { tool } from "ai";
import { z } from "zod";
import type { SkillDefinition } from "../../../types.js";

export function createTwentySkillSearchTool(skills: SkillDefinition[]) {
  return tool({
    description:
      "Twenty skill discovery tool. Search Twenty-backed HR agent skills before loading skill docs or calling recruiting tools.",
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

export function createTwentySkillLoadTool(skills: SkillDefinition[]) {
  return tool({
    description: "Load full Markdown instructions for one or more Twenty-backed HR agent skills.",
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

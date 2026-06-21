import crypto from "node:crypto";
import type { SkillCacheResult, SkillDefinition } from "../types.js";
import { DEFAULT_SKILLS, TWENTY_SKILLS } from "../skills-content.js";

const cache = new Map<string, SkillCacheResult>();

export async function loadDefaultSkills(input: { useCache: boolean }): Promise<SkillCacheResult> {
  return buildCacheResult(DEFAULT_SKILLS, "Default HR Agent Skills", input.useCache, "default");
}

export async function loadTwentySkills(input: { useCache: boolean }): Promise<SkillCacheResult> {
  return buildCacheResult(TWENTY_SKILLS, "Twenty-backed HR Agent Skills", input.useCache, "twenty");
}

function buildCacheResult(
  skills: SkillDefinition[],
  promptTitle: string,
  useCache: boolean,
  cacheKey: string
): SkillCacheResult {
  if (useCache) {
    const cached = cache.get(cacheKey);
    if (cached) return { ...cached, status: "hit" };
  }

  const defaultSkillsPromptBlock = buildSkillsPromptBlock(skills, promptTitle);
  const hash = crypto.createHash("sha256").update(defaultSkillsPromptBlock).digest("hex");

  const result: SkillCacheResult = {
    status: useCache ? "miss" : "bypass",
    skills,
    defaultSkillsPromptBlock,
    hash,
  };

  if (useCache) {
    cache.set(cacheKey, result);
  }

  return result;
}

export function clearSkillCache() {
  cache.clear();
}

function buildSkillsPromptBlock(skills: SkillDefinition[], promptTitle: string) {
  const sections = skills.map((skill) =>
    [`## ${skill.id}: ${skill.name}`, `Description: ${skill.description}`].join("\n"),
  );

  return [
    `# ${promptTitle}`,
    "This is a stable skill index, not full skill documentation.",
    "Use `skills_search` as the default first step when choosing a business skill.",
    "Load full skill instructions with `skills_load` only for the specific skill ids needed for the current turn.",
    "Do not load every skill by default.",
    ...sections,
  ].join("\n\n");
}

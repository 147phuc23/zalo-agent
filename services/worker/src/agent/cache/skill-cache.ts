import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SkillCacheResult, SkillDefinition } from "../types.js";

let memoized: SkillCacheResult | null = null;

export async function loadDefaultSkills(input: { useCache: boolean }): Promise<SkillCacheResult> {
  if (input.useCache && memoized) {
    return { ...memoized, status: "hit" };
  }

  const skillsRoot = getSkillsRoot();
  const entries = await fs.readdir(skillsRoot, { withFileTypes: true });
  const skills: SkillDefinition[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillId = entry.name;
    const filePath = path.join(skillsRoot, skillId, "SKILL.md");
    const content = await fs.readFile(filePath, "utf-8");
    skills.push(parseSkillMarkdown({ id: skillId, filePath, content }));
  }

  skills.sort((a, b) => a.id.localeCompare(b.id));
  const defaultSkillsPromptBlock = buildDefaultSkillsPromptBlock(skills);
  const hash = crypto.createHash("sha256").update(defaultSkillsPromptBlock).digest("hex");

  const result: SkillCacheResult = {
    status: input.useCache ? "miss" : "bypass",
    skills,
    defaultSkillsPromptBlock,
    hash,
  };

  if (input.useCache) {
    memoized = result;
  }

  return result;
}

export function clearSkillCache() {
  memoized = null;
}

function getSkillsRoot() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, "../skills");
}

function parseSkillMarkdown(input: {
  id: string;
  filePath: string;
  content: string;
}): SkillDefinition {
  const title = /^#\s+(.+)$/m.exec(input.content)?.[1]?.trim() ?? input.id;
  const description =
    /^Description:\s*(.+)$/m.exec(input.content)?.[1]?.trim() ??
    firstParagraph(input.content) ??
    title;

  return {
    id: input.id,
    name: title,
    description,
    content: input.content.trim(),
    filePath: input.filePath,
  };
}

function firstParagraph(content: string) {
  return content
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .find((part) => part && !part.startsWith("#"));
}

function buildDefaultSkillsPromptBlock(skills: SkillDefinition[]) {
  const sections = skills.map((skill) => [
    `## ${skill.id}: ${skill.name}`,
    `Description: ${skill.description}`,
  ].join("\n"));

  return [
    "# Default HR Agent Skills",
    "This is a stable skill index, not full skill documentation.",
    "Use `skills_search` as the default first step when choosing a business skill.",
    "Load full skill instructions with `skills_load` only for the specific skill ids needed for the current turn.",
    "Do not load every skill by default.",
    ...sections,
  ].join("\n\n");
}

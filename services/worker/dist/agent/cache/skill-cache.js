import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const memoizedByRoot = new Map();
export async function loadDefaultSkills(input) {
    return loadSkillsFromDirectory({
        skillsRoot: getDefaultSkillsRoot(),
        useCache: input.useCache,
        promptTitle: "Default HR Agent Skills",
    });
}
export async function loadTwentySkills(input) {
    return loadSkillsFromDirectory({
        skillsRoot: getTwentySkillsRoot(),
        useCache: input.useCache,
        promptTitle: "Twenty-backed HR Agent Skills",
    });
}
export async function loadSkillsFromDirectory(input) {
    const resolvedRoot = path.resolve(input.skillsRoot);
    if (input.useCache) {
        const memoized = memoizedByRoot.get(resolvedRoot);
        if (memoized) {
            return { ...memoized, status: "hit" };
        }
    }
    const entries = await fs.readdir(resolvedRoot, { withFileTypes: true });
    const skills = [];
    const SKIP_DIRS = new Set(["global", "twenty"]);
    for (const entry of entries) {
        if (!entry.isDirectory())
            continue;
        if (SKIP_DIRS.has(entry.name))
            continue;
        const skillId = entry.name;
        const filePath = path.join(resolvedRoot, skillId, "SKILL.md");
        try {
            const content = await fs.readFile(filePath, "utf-8");
            skills.push(parseSkillMarkdown({ id: skillId, filePath, content }));
        }
        catch (err) {
            if (err.code === "ENOENT") {
                continue;
            }
            throw err;
        }
    }
    skills.sort((a, b) => a.id.localeCompare(b.id));
    const defaultSkillsPromptBlock = buildSkillsPromptBlock(skills, input.promptTitle);
    const hash = crypto.createHash("sha256").update(defaultSkillsPromptBlock).digest("hex");
    const result = {
        status: input.useCache ? "miss" : "bypass",
        skills,
        defaultSkillsPromptBlock,
        hash,
    };
    if (input.useCache) {
        memoizedByRoot.set(resolvedRoot, result);
    }
    return result;
}
export function clearSkillCache() {
    memoizedByRoot.clear();
}
function getDefaultSkillsRoot() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    return path.resolve(__dirname, "../skills");
}
function getTwentySkillsRoot() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    return path.resolve(__dirname, "../skills/twenty");
}
function parseSkillMarkdown(input) {
    const title = /^#\s+(.+)$/m.exec(input.content)?.[1]?.trim() ?? input.id;
    const description = /^Description:\s*(.+)$/m.exec(input.content)?.[1]?.trim() ??
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
function firstParagraph(content) {
    return content
        .split(/\n\s*\n/)
        .map((part) => part.trim())
        .find((part) => part && !part.startsWith("#"));
}
function buildSkillsPromptBlock(skills, promptTitle) {
    const sections = skills.map((skill) => [`## ${skill.id}: ${skill.name}`, `Description: ${skill.description}`].join("\n"));
    return [
        `# ${promptTitle}`,
        "This is a stable skill index, not full skill documentation.",
        "Use `skills_search` as the default first step when choosing a business skill.",
        "Load full skill instructions with `skills_load` only for the specific skill ids needed for the current turn.",
        "Do not load every skill by default.",
        ...sections,
    ].join("\n\n");
}

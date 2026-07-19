import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mdPath = path.join(__dirname, "core-instructions.md");
export const CORE_HR_AGENT_INSTRUCTIONS = fs.readFileSync(mdPath, "utf8").trim();

function extractSection(markdown: string, heading: string): string {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escapedHeading}\\n([\\s\\S]*?)(?=\\n---|\\n# )`, "m");
  const match = pattern.exec(markdown);
  if (!match) {
    throw new Error(`Section "${heading}" not found in core-instructions.md`);
  }
  return match[1].trim();
}

export const PERSONA_EXAMPLES = extractSection(CORE_HR_AGENT_INSTRUCTIONS, "# Signature Example Exchanges");

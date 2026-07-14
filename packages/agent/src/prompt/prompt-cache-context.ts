import type { CoreMessage } from "ai";
import type {
  CandidateProfile,
  HrAgentState,
  SkillCacheResult,
  SkillDefinition,
} from "../types.js";
import { CORE_HR_AGENT_INSTRUCTIONS } from "./core-instructions.js";
import { CANONICAL_LOCATIONS } from "../core/location-normalizer.js";

export type PromptCacheContext = {
  system: string;
  prompt: string;
  stablePrefix: string;
  dynamicContext: string;
  messages: CoreMessage[];
  diagnostics: PromptCacheDiagnostics;
};

export type PromptCacheDiagnostics = {
  sections: Array<{
    name: string;
    placement: "system" | "user";
    cacheCandidate: boolean;
    chars: number;
    estimatedTokens: number;
  }>;
  totalChars: number;
  estimatedTotalTokens: number;
};

export function buildPromptCacheContext(input: {
  skillCache: SkillCacheResult;
  loadedSkills: SkillDefinition[];
  customerProfile: CandidateProfile;
  state: HrAgentState;
  knownFacts?: string;
  systemPromptOverride?: string;
}): PromptCacheContext {
  let coreInstructions = CORE_HR_AGENT_INSTRUCTIONS;
  if (input.systemPromptOverride) {
    const trimmed = input.systemPromptOverride.trim();
    if (trimmed.includes("IMPORTANT: The candidate has sent a message that you are replying to:")) {
      const idx = trimmed.indexOf("IMPORTANT:");
      const targetInstruction = trimmed.slice(idx);
      const prefix = trimmed.slice(0, idx).trim();
      if (prefix) {
        coreInstructions = prefix + "\n\n" + targetInstruction;
      } else {
        coreInstructions = CORE_HR_AGENT_INSTRUCTIONS + "\n\n" + targetInstruction;
      }
    } else {
      coreInstructions = input.systemPromptOverride;
    }
  }

  const locationsBlock = [
    "# Supported Locations",
    "Use the following canonical location slugs for matching candidate preferences:",
    ...CANONICAL_LOCATIONS.map((loc) => `- ${loc.englishName} (${loc.vietnameseName}): slug "${loc.slug}" (aliases: ${loc.aliases.join(", ")})`),
  ].join("\n");

  const stablePrefix = [
    coreInstructions,
    locationsBlock,
    input.skillCache.defaultSkillsPromptBlock,
  ].join("\n\n");

  const stateHeader = [
    "# Conversation State Context",
    `- tenantId: ${input.state.tenantId}`,
    `- channel: ${input.state.channel}`,
    `- threadId: ${input.state.threadId}`,
    `- externalUserId: ${input.state.externalUserId}`,
    `- version: ${input.state.version}`,
    `- intent: ${input.state.intent || "null"}`,
    `- requirement: ${Object.keys(input.state.requirement).length > 0 ? JSON.stringify(input.state.requirement) : "{}"}`,
    `- loadedSkills: ${input.state.loadedSkills.length > 0 ? input.state.loadedSkills.join(", ") : "[]"}`,
  ].join("\n");

  const dynamicContextParts = [
    buildLoadedSkillsBlock(input.loadedSkills),
    "# Customer Profile Snapshot",
    formatProfile(input.customerProfile),
    input.knownFacts || "",
    stateHeader,
  ].filter(Boolean);

  const dynamicContext = dynamicContextParts.join("\n\n");

  const system = [
    stablePrefix,
    dynamicContext,
  ].join("\n\n");

  const messages = buildChatMessages(input.state.history);

  return {
    stablePrefix,
    system,
    dynamicContext,
    prompt: "", // Native multi-turn messages array is used instead of prompt string
    messages,
    diagnostics: buildDiagnostics({
      coreInstructions,
      skillIndex: input.skillCache.defaultSkillsPromptBlock,
      loadedSkills: buildLoadedSkillsBlock(input.loadedSkills),
      dynamicContext,
    }),
  };
}

function buildChatMessages(history: HrAgentState["history"]): CoreMessage[] {
  // Safe trim to avoid context bloup, keeping the last 60 turns
  const recentHistory = history.slice(-60);
  return recentHistory.map((msg) => ({
    role: msg.role === "assistant" ? "assistant" as const : "user" as const,
    content: msg.content,
  }));
}

function buildLoadedSkillsBlock(skills: SkillDefinition[]) {
  if (skills.length === 0) {
    return "# Loaded Skills\nNo additional non-default skills are loaded.";
  }

  return [
    "# Loaded Skills",
    ...skills.map((skill) => `## ${skill.id}: ${skill.name}\n${skill.content}`),
  ].join("\n\n");
}

function formatProfile(profile: CandidateProfile): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(profile)) {
    if (value === null || value === undefined || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    lines.push(`- ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
  }
  return lines.length > 0 ? lines.join("\n") : "No profile data available.";
}

function buildDiagnostics(input: {
  coreInstructions: string;
  skillIndex: string;
  loadedSkills: string;
  dynamicContext: string;
}): PromptCacheDiagnostics {
  const sections: PromptCacheDiagnostics["sections"] = [
    sectionDiagnostics("coreInstructions", "system", true, input.coreInstructions),
    sectionDiagnostics("skillIndex", "system", true, input.skillIndex),
    sectionDiagnostics("loadedSkills", "user", false, input.loadedSkills),
    sectionDiagnostics("dynamicConversationContext", "user", false, input.dynamicContext),
  ];

  const totalChars = sections.reduce((sum, section) => sum + section.chars, 0);

  return {
    sections,
    totalChars,
    estimatedTotalTokens: estimateTokens(totalChars),
  };
}

function sectionDiagnostics(
  name: string,
  placement: "system" | "user",
  cacheCandidate: boolean,
  content: string,
) {
  return {
    name,
    placement,
    cacheCandidate,
    chars: content.length,
    estimatedTokens: estimateTokens(content.length),
  };
}

function estimateTokens(chars: number) {
  return Math.ceil(chars / 4);
}

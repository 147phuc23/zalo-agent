import type {
  CandidateProfile,
  HrAgentState,
  MockZaloPayload,
  SkillCacheResult,
  SkillDefinition,
} from "../types.js";

const CORE_HR_AGENT_INSTRUCTIONS = [
  "# HR Chat Agent Responsibility",
  "You are an HR recruiter chat agent for Zalo conversations.",
  "Reply in Vietnamese unless the candidate writes in English.",
  "Your job is to gather candidate requirements, avoid asking for known CRM details, search matching jobs when enough information exists, and save interaction state/history through skills.",
  "Always use skills for CRM/profile lookup, requirement updates, job search, memory, and history when relevant.",
  "Use CRM profile write skills when the candidate shares durable profile facts or recruiter notes. Use requirement skills for temporary job-search criteria.",
  "Ask at most one focused follow-up question when important requirement fields are missing.",
].join("\n");

export type PromptCacheContext = {
  system: string;
  prompt: string;
  stablePrefix: string;
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
  latestMessages: MockZaloPayload[];
}): PromptCacheContext {
  const stablePrefix = [
    CORE_HR_AGENT_INSTRUCTIONS,
    input.skillCache.defaultSkillsPromptBlock,
  ].join("\n\n");

  const dynamicContext = [
    buildLoadedSkillsBlock(input.loadedSkills),
    "# Customer Profile Snapshot",
    jsonBlock(input.customerProfile),
    "# Conversation State",
    jsonBlock({
      tenantId: input.state.tenantId,
      channel: input.state.channel,
      threadId: input.state.threadId,
      externalUserId: input.state.externalUserId,
      version: input.state.version,
      intent: input.state.intent ?? null,
      requirement: input.state.requirement,
      loadedSkills: input.state.loadedSkills,
      history: input.state.history.slice(-8).map((entry) => ({
        role: entry.role,
        content: entry.content,
        createdAt: entry.createdAt,
      })),
    }),
    "# Latest Zalo Messages",
    jsonBlock(input.latestMessages.map((message) => ({
      id: message.id,
      text: message.text,
      receivedAt: message.receivedAt,
    }))),
    "# Required Agent Output",
    "Use tools as needed. Then produce the next concise recruiter reply for the candidate.",
  ].join("\n\n");

  return {
    stablePrefix,
    system: stablePrefix,
    prompt: dynamicContext,
    diagnostics: buildDiagnostics({
      coreInstructions: CORE_HR_AGENT_INSTRUCTIONS,
      skillIndex: input.skillCache.defaultSkillsPromptBlock,
      loadedSkills: buildLoadedSkillsBlock(input.loadedSkills),
      dynamicContext,
    }),
  };
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

function jsonBlock(value: unknown) {
  return `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
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

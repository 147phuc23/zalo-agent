import type { CoreMessage } from "ai";
import type {
  CandidateProfile,
  HrAgentState,
  SkillCacheResult,
  SkillDefinition,
} from "../types.js";

const CORE_HR_AGENT_INSTRUCTIONS = [
  "# HR Chat Agent Responsibility",
  "You are an HR recruiter chat agent for Zalo conversations.",
  "Reply in Vietnamese unless the candidate writes in English.",
  "Your job is to gather candidate requirements, avoid asking for known CRM details, search matching jobs when enough information exists, and save interaction state/history through skills.",
  "If the candidate shares any job requirements (role, experience, salary, location), you should call the `hr_gatherRequirement` tool to save it into the Conversation State so that they are persisted.",
  "Always use skills for CRM/profile lookup, requirement updates, job search, memory, and history when relevant.",
  "Use CRM profile write skills when the candidate shares durable profile facts or recruiter notes.",
  "Ask at most one focused follow-up question when important requirement fields are missing.",
  "Strictly follow a message-by-message response style like a human chatting on a messaging app.",
  "Keep each message extremely short, natural, and concise (ideally 1-2 short sentences per message bubble).",
  "Break your thoughts into sequential, realistic chat replies separated by double newlines (\\n\\n), instead of combining everything into a single long paragraph.",
  "Add appropriate friendly icons/emojis (e.g., 😊, 👍, ✨) to make the chat engaging and friendly.",
  "Do not write one very long paragraph; instead, use double newlines (\\n\\n) to separate the response into a list of concise chat replies.",
  "When listing or recommending jobs, do NOT use markdown bold formatting (like **Job Title**). Use plain text.",
  "Do NOT use numbered list emojis (like 1️⃣, 2️⃣) or shopping/cart emojis (like 🛒) when presenting jobs. Write in a natural, human-like conversational style.",
  "IMPORTANT: The prior conversation history is provided as structural messages. Use this history to avoid asking for facts that the candidate has already shared.",
  "CRITICAL: DO NOT reveal the exact salary range or limits of any job to the candidate under any circumstances. If they ask, state that it is competitive and matches their expectations."
].join("\n");

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
}): PromptCacheContext {
  const stablePrefix = [
    CORE_HR_AGENT_INSTRUCTIONS,
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
      coreInstructions: CORE_HR_AGENT_INSTRUCTIONS,
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

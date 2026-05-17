export type Channel = "zalo";

export type HrSkillMode = "mock" | "twenty";

export type MockZaloPayload = {
  id: string;
  tenantId: string;
  channel: Channel;
  threadId: string;
  externalUserId: string;
  text: string;
  receivedAt: string;
  raw: Record<string, unknown>;
};

export type CandidateProfile = {
  externalUserId: string;
  displayName: string;
  phone?: string;
  email?: string;
  location?: string;
  yearsOfExperience?: number;
  currentTitle?: string;
  skills: string[];
  preferredRoles: string[];
  salaryExpectationVnd?: number;
  availability?: string;
  notes?: string[];
};

export type CandidateRequirement = {
  role?: string;
  location?: string;
  salaryMinVnd?: number;
  salaryMaxVnd?: number;
  yearsOfExperience?: number;
  workMode?: "remote" | "hybrid" | "onsite";
  skills?: string[];
  availability?: string;
  language?: string;
  constraints?: string[];
};

export type JobPosting = {
  id: string;
  title: string;
  company: string;
  location: string;
  workMode: "remote" | "hybrid" | "onsite";
  salaryMinVnd: number;
  salaryMaxVnd: number;
  seniority: string;
  requiredSkills: string[];
  description: string;
};

export type AgentHistoryEntry = {
  role: "user" | "assistant" | "tool";
  content: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type HrAgentState = {
  tenantId: string;
  channel: Channel;
  threadId: string;
  externalUserId: string;
  version: number;
  intent?: string;
  requirement: CandidateRequirement;
  loadedSkills: string[];
  history: AgentHistoryEntry[];
};

export type CacheStatus = "hit" | "miss" | "bypass";

export type SkillDefinition = {
  id: string;
  name: string;
  description: string;
  content: string;
  filePath: string;
};

export type SkillCacheResult = {
  status: CacheStatus;
  skills: SkillDefinition[];
  defaultSkillsPromptBlock: string;
  hash: string;
};

export type CustomerProfileCacheResult = {
  status: CacheStatus;
  profile: CandidateProfile;
};

export type HrScenario = {
  id: string;
  name: string;
  description: string;
  tenantId: string;
  channel: Channel;
  threadId: string;
  externalUserId: string;
  messages: MockZaloPayload[];
  forceProfileReload?: boolean;
};

export type HrAgentRunOptions = {
  scenario: HrScenario;
  model: string;
  useLocalCache: boolean;
  forceProfileReload: boolean;
  printCache: boolean;
  mockLlm: boolean;
  skillMode: HrSkillMode;
};

export type HrAgentRunResult = {
  scenarioId: string;
  assistantText: string;
  state: HrAgentState;
  cache: {
    skillCache: CacheStatus;
    skillPromptHash: string;
    profileCache: CacheStatus;
    provider?: Record<string, unknown>;
    prompt?: {
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
  };
  steps: Array<{
    text?: string;
    toolCalls?: unknown[];
    toolResults?: unknown[];
  }>;
};

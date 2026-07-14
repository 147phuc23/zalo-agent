import { generateText } from "ai";
import type { LanguageModel, ProviderMetadata } from "ai";
import { createOpenRouterChatModel } from "@platform/ai-client";
import { CustomerProfileCache } from "../cache/customer-profile-cache.js";
import { buildProviderCacheSettings, readProviderCacheDiagnostics } from "../cache/provider-cache.js";
import { loadDefaultSkills, loadTwentySkills } from "../cache/skill-cache.js";
import { getHistory, getIntent } from "../mock/store.js";
import { buildPromptCacheContext } from "../prompt/prompt-cache-context.js";
import {
  getMockCandidateProfile,
  getMockCandidateProfileRevision,
} from "../skills/crm-get-candidate-profile/mock-data.js";
import { createAgentTools } from "../skills/registry.js";
import { createTwentyAgentTools } from "../skills/twenty/registry.js";
import { createTwentyRecruitingClientFromEnv } from "../twenty/recruiting-client.js";
import { createDatabaseClient, createJobPostingRepository, type JobPostingRow } from "@platform/database";
import type { HrAgentRunOptions, HrAgentRunResult, HrAgentState, JobPosting, SkillCacheResult } from "../types.js";

// Lazily-created, reused jobs repo backed by PLATFORM_DB_URL (Neon). Null when unset,
// in which case load-jobs falls back to the in-code mock list.
let jobsRepoSingleton: ReturnType<typeof createJobPostingRepository> | null = null;
function getJobsRepo() {
  if (jobsRepoSingleton) return jobsRepoSingleton;
  const url = process.env.PLATFORM_DB_URL;
  if (!url) return null;
  jobsRepoSingleton = createJobPostingRepository(createDatabaseClient({ PLATFORM_DB_URL: url }));
  return jobsRepoSingleton;
}

function jobRowToPosting(row: JobPostingRow): JobPosting {
  return {
    id: row.external_id ?? row.id,
    title: row.title,
    company: row.company,
    location: row.location,
    workMode: row.work_mode,
    salaryMinVnd: Number(row.salary_min_vnd),
    salaryMaxVnd: Number(row.salary_max_vnd),
    seniority: row.seniority,
    requiredSkills: row.required_skills ?? [],
    description: row.description,
    jobType: (row.job_type as JobPosting["jobType"]) ?? undefined,
    experienceRequiredYears: row.experience_required_years ?? undefined,
    benefits: row.benefits ?? undefined,
    educationRequired: row.education_required ?? undefined,
  };
}

const customerProfileCache = new CustomerProfileCache();

export async function runHrAgentScenario(options: HrAgentRunOptions): Promise<HrAgentRunResult> {
  const skillCache =
    options.skillMode === "twenty"
      ? await loadTwentySkills({ useCache: options.useLocalCache })
      : await loadDefaultSkills({ useCache: options.useLocalCache });

  const profileCache = await customerProfileCache.get({
    tenantId: options.scenario.tenantId,
    channel: options.scenario.channel,
    externalUserId: options.scenario.externalUserId,
    forceReload: options.forceProfileReload || Boolean(options.scenario.forceProfileReload),
    useCache: options.useLocalCache,
    cacheVersion:
      options.skillMode === "twenty" ? "twenty-recruiting-v1" : getMockCandidateProfileRevision(),
    loader: async (input) => {
      if (options.skillMode === "twenty") {
        const client = createTwentyRecruitingClientFromEnv();
        return client.loadCandidateProfile({ externalUserId: input.externalUserId });
      }

      return getMockCandidateProfile(input);
    },
  });

  const state = buildInitialState(options);
  const promptContext = buildPromptCacheContext({
    skillCache,
    loadedSkills: [],
    customerProfile: profileCache.profile,
    state,
    knownFacts: options.knownFacts,
    systemPromptOverride: options.systemPromptOverride,
  });

  if (options.mockLlm) {
    return buildMockResult({
      options,
      state,
      skillCache,
      profileCacheStatus: profileCache.status,
      promptHash: skillCache.hash,
      promptDiagnostics: promptContext.diagnostics,
    });
  }

  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is required unless --mock-llm is passed");
  }

  const providerCache = buildProviderCacheSettings({
    model: options.model,
    enabled: true,
  });

  const jobsRepo = getJobsRepo();
  const tools =
    options.skillMode === "twenty"
      ? createTwentyAgentTools(skillCache.skills)
      : createAgentTools(skillCache.skills, {
          loadJobs: jobsRepo
            ? {
                listJobs: async () => {
                  const rows = await jobsRepo.listActive({ tenantId: options.scenario.tenantId });
                  return rows.map(jobRowToPosting);
                },
              }
            : undefined,
        });

  const result = await generateText({
    model: createOpenRouterChatModel({
      model: options.model,
      enablePromptCaching: providerCache.enableProviderPromptCaching,
    }) as unknown as LanguageModel,
    system: promptContext.system,
    messages: promptContext.messages,
    tools,
    maxSteps: 8,
    maxTokens: 2000,
    temperature: 0.2,
    providerOptions: providerCache.providerOptions as ProviderMetadata,
    abortSignal: options.abortSignal,
    onStepFinish: async (step) => {
      if (options.onStepFinish) {
        await options.onStepFinish({
          text: step.text,
          toolCalls: step.toolCalls,
          toolResults: step.toolResults,
        });
      }
    },
  });



  return {
    scenarioId: options.scenario.id,
    assistantText: result.text,
    state,
    cache: {
      skillCache: skillCache.status,
      skillPromptHash: skillCache.hash,
      profileCache: profileCache.status,
      provider: readProviderCacheDiagnostics(result),
      prompt: promptContext.diagnostics,
    },
    steps: (result.steps ?? []).map((step: AgentStepResult) => ({
      text: step.text,
      toolCalls: step.toolCalls,
      toolResults: step.toolResults,
    })),
  };
}

export function clearHrAgentProfileCache() {
  customerProfileCache.clear();
}

function buildInitialState(options: HrAgentRunOptions): HrAgentState {
  const now = new Date().toISOString();

  return {
    tenantId: options.scenario.tenantId,
    channel: options.scenario.channel,
    threadId: options.scenario.threadId,
    externalUserId: options.scenario.externalUserId,
    version: 1,
    requirement: {},
    loadedSkills: [],
    history: options.scenario.messages.map((message) => ({
      role: message.externalUserId === "agent" ? "assistant" : "user",
      content: message.text,
      createdAt: message.receivedAt || now,
      metadata: {
        id: message.id,
        raw: message.raw,
      },
    })),
  };
}

function buildMockResult(input: {
  options: HrAgentRunOptions;
  state: HrAgentState;
  skillCache: SkillCacheResult;
  profileCacheStatus: "hit" | "miss" | "bypass";
  promptHash: string;
  promptDiagnostics: HrAgentRunResult["cache"]["prompt"];
}): HrAgentRunResult {
  const latestText = input.options.scenario.messages.map((message) => message.text).join(" ");

  return {
    scenarioId: input.options.scenario.id,
    assistantText: `MOCK LLM: Mình đã nhận thông tin "${latestText}". Bạn cho mình thêm vai trò mong muốn và mức lương kỳ vọng nhé.`,
    state: input.state,
    cache: {
      skillCache: input.skillCache.status,
      skillPromptHash: input.promptHash,
      profileCache: input.profileCacheStatus,
      prompt: input.promptDiagnostics,
      provider: {
        mode: "mock",
      },
    },
    steps: [
      {
        text: "Mock run skipped provider call.",
        toolCalls: [],
        toolResults: [],
      },
    ],
  };
}

type AgentStepResult = {
  text?: string;
  toolCalls?: unknown[];
  toolResults?: unknown[];
};

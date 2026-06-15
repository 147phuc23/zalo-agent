import { generateText } from "ai";
import { createOpenRouterChatModel } from "@platform/ai-client";
import { CustomerProfileCache } from "../cache/customer-profile-cache.js";
import { buildProviderCacheSettings, readProviderCacheDiagnostics } from "../cache/provider-cache.js";
import { loadDefaultSkills, loadTwentySkills } from "../cache/skill-cache.js";
import { getHistory, getIntent } from "../mock/store.js";
import { buildPromptCacheContext } from "../prompt/prompt-cache-context.js";
import { getMockCandidateProfile, getMockCandidateProfileRevision, } from "../skills/crm-get-candidate-profile/mock-data.js";
import { createAgentTools } from "../skills/registry.js";
import { createTwentyAgentTools } from "../skills/twenty/registry.js";
import { createTwentyRecruitingClientFromEnv } from "../twenty/recruiting-client.js";
const customerProfileCache = new CustomerProfileCache();
export async function runHrAgentScenario(options) {
    const skillCache = options.skillMode === "twenty"
        ? await loadTwentySkills({ useCache: options.useLocalCache })
        : await loadDefaultSkills({ useCache: options.useLocalCache });
    const profileCache = await customerProfileCache.get({
        tenantId: options.scenario.tenantId,
        channel: options.scenario.channel,
        externalUserId: options.scenario.externalUserId,
        forceReload: options.forceProfileReload || Boolean(options.scenario.forceProfileReload),
        useCache: options.useLocalCache,
        cacheVersion: options.skillMode === "twenty" ? "twenty-recruiting-v1" : getMockCandidateProfileRevision(),
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
    const tools = options.skillMode === "twenty"
        ? createTwentyAgentTools(skillCache.skills)
        : createAgentTools(skillCache.skills);
    const result = await generateText({
        model: createOpenRouterChatModel({
            model: options.model,
            enablePromptCaching: providerCache.enableProviderPromptCaching,
        }),
        system: options.systemPromptOverride || promptContext.system,
        prompt: promptContext.prompt,
        tools,
        maxSteps: 8,
        maxTokens: 2000,
        temperature: 0.2,
        providerOptions: providerCache.providerOptions,
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
    const savedIntent = getIntent({
        tenantId: options.scenario.tenantId,
        threadId: options.scenario.threadId,
    });
    const history = getHistory({
        tenantId: options.scenario.tenantId,
        threadId: options.scenario.threadId,
    });
    state.intent = savedIntent?.intent ?? state.intent;
    state.requirement = savedIntent?.requirement ?? state.requirement;
    state.history = history.length > 0 ? history : state.history;
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
        steps: (result.steps ?? []).map((step) => ({
            text: step.text,
            toolCalls: step.toolCalls,
            toolResults: step.toolResults,
        })),
    };
}
export function clearHrAgentProfileCache() {
    customerProfileCache.clear();
}
function buildInitialState(options) {
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
function buildMockResult(input) {
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

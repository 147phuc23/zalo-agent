export type GenerateInput = {
    model: string;
    system?: string;
    prompt: string;
    temperature?: number;
    responseFormat?: {
        type: "json_object" | "text";
    };
};
export type GenerateOutput = {
    text: string;
    model: string;
};
export type OpenRouterChatModelOptions = {
    model: string;
    enablePromptCaching?: boolean;
};
export declare class OpenRouterAiClient {
    generate(input: GenerateInput): Promise<GenerateOutput>;
}
export declare function createOpenRouterChatModel(input: OpenRouterChatModelOptions): {
    specificationVersion: "v1";
    provider: string;
    modelId: string;
    defaultObjectGenerationMode: "json";
    supportsStructuredOutputs: boolean;
    doGenerate(options: LanguageModelCallOptions): Promise<{
        text: string | undefined;
        toolCalls: {
            toolCallType: "function";
            toolCallId: string;
            toolName: string;
            args: string;
        }[] | undefined;
        finishReason: string;
        usage: {
            promptTokens: number;
            completionTokens: number;
        };
        rawCall: {
            rawPrompt: unknown;
            rawSettings: Record<string, unknown>;
        };
        rawResponse: {
            headers: {
                [k: string]: string;
            };
            body: OpenRouterChatResponse;
        };
        request: {
            body: string;
        };
        response: {
            id: string | undefined;
            timestamp: Date | undefined;
            modelId: string | undefined;
        };
        providerMetadata: {
            openrouter: {
                cachedTokens: number;
                cacheWriteTokens: number;
                cacheControlApplied: boolean;
            };
        };
        warnings: never[];
    }>;
    doStream(): Promise<never>;
};
type OpenRouterChatResponse = {
    id?: string;
    model?: string;
    created?: number;
    choices?: Array<{
        finish_reason?: string | null;
        message?: {
            content?: string | null;
            tool_calls?: Array<{
                id: string;
                type: "function";
                function: {
                    name: string;
                    arguments: string;
                };
            }>;
        };
    }>;
    usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        prompt_tokens_details?: {
            cached_tokens?: number;
            cache_write_tokens?: number;
        };
    };
};
type LanguageModelCallOptions = {
    headers?: Record<string, string | undefined>;
    abortSignal?: AbortSignal;
    prompt: PromptMessage[];
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stopSequences?: string[];
    responseFormat?: {
        type: "text" | "json";
    };
    mode?: {
        type: string;
        tools?: ToolDefinition[];
        toolChoice?: ToolChoice;
    };
};
type PromptMessage = {
    role: "system";
    content: string;
} | {
    role: "user";
    content: unknown;
} | {
    role: "assistant";
    content?: unknown[];
} | {
    role: "tool";
    content?: ToolResultPart[];
};
type ToolDefinition = {
    type: string;
    name: string;
    description?: string;
    parameters: unknown;
};
type ToolChoice = {
    type: "auto" | "none" | "required";
} | {
    type: "tool";
    toolName: string;
};
type ToolResultPart = {
    toolCallId: string;
    toolName: string;
    result?: unknown;
};
export {};

import { z } from "zod";

const OpenRouterEnvSchema = z.object({
  OPENROUTER_API_KEY: z.string().min(20),
  OPENROUTER_BASE_URL: z.string().url().default("https://openrouter.ai/api/v1"),
});

function isOpenRouterDebugEnabled() {
  const v = process.env.DEBUG_OPENROUTER ?? process.env.OPENROUTER_DEBUG;
  return v === "1" || v === "true";
}

function maskSecret(value: string) {
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function logOpenRouterDebug(context: string, fields: Record<string, unknown>) {
  if (!isOpenRouterDebugEnabled()) return;
  console.log(`[openrouter:debug] ${context}`, fields);
}

export type GenerateInput = {
  model: string;
  system?: string;
  prompt: string;
  temperature?: number;
};

export type GenerateOutput = {
  text: string;
  model: string;
};

export type OpenRouterChatModelOptions = {
  model: string;
  enablePromptCaching?: boolean;
};

export class OpenRouterAiClient {
  async generate(input: GenerateInput): Promise<GenerateOutput> {
    const env = OpenRouterEnvSchema.parse(process.env);
    const url = `${env.OPENROUTER_BASE_URL}/chat/completions`;
    logOpenRouterDebug("OpenRouterAiClient.generate", {
      requestUrl: url,
      OPENROUTER_BASE_URL: env.OPENROUTER_BASE_URL,
      OPENROUTER_BASE_URL_fromEnv: Boolean(process.env.OPENROUTER_BASE_URL),
      OPENROUTER_API_KEY: maskSecret(env.OPENROUTER_API_KEY),
      model: input.model,
      temperature: input.temperature,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        messages: buildMessages(input),
        temperature: input.temperature,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `OpenRouter request failed with status ${response.status}: ${errorBody}`,
      );
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
        };
      }>;
    };

    const text = payload.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) {
      throw new Error("OpenRouter response did not include assistant content");
    }

    return { text, model: input.model };
  }
}

function buildMessages(input: GenerateInput) {
  const messages: Array<{ role: "system" | "user"; content: string }> = [];

  if (input.system) {
    messages.push({ role: "system", content: input.system });
  }

  messages.push({ role: "user", content: input.prompt });

  return messages;
}

export function createOpenRouterChatModel(input: OpenRouterChatModelOptions) {
  return {
    specificationVersion: "v1" as const,
    provider: "openrouter",
    modelId: input.model,
    defaultObjectGenerationMode: "json" as const,
    supportsStructuredOutputs: false,
    async doGenerate(options: LanguageModelCallOptions) {
      const env = OpenRouterEnvSchema.parse(process.env);
      const body = buildOpenRouterChatBody({
        model: input.model,
        options,
        enablePromptCaching: input.enablePromptCaching ?? true,
      });
      const url = `${env.OPENROUTER_BASE_URL}/chat/completions`;
      logOpenRouterDebug("createOpenRouterChatModel.doGenerate", {
        requestUrl: url,
        OPENROUTER_BASE_URL: env.OPENROUTER_BASE_URL,
        OPENROUTER_BASE_URL_fromEnv: Boolean(process.env.OPENROUTER_BASE_URL),
        OPENROUTER_API_KEY: maskSecret(env.OPENROUTER_API_KEY),
        model: input.model,
        enablePromptCaching: input.enablePromptCaching ?? true,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        toolCount:
          options.mode?.type === "regular"
            ? options.mode.tools?.filter(isFunctionTool).length
            : undefined,
      });

      const response = await fetch(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
          "content-type": "application/json",
          accept: "application/json",
          ...options.headers,
        },
        body: JSON.stringify(body),
        signal: options.abortSignal,
      });

      const responseHeaders = Object.fromEntries(response.headers.entries());
      const payload = (await response.json().catch(async () => ({
        error: await response.text(),
      }))) as OpenRouterChatResponse;

      if (!response.ok) {
        throw new Error(
          `OpenRouter request failed with status ${response.status}: ${JSON.stringify(payload)}`,
        );
      }

      const choice = payload.choices?.[0];
      const message = choice?.message ?? {};
      const toolCalls = message.tool_calls?.map((toolCall) => ({
        toolCallType: "function" as const,
        toolCallId: toolCall.id,
        toolName: toolCall.function.name,
        args: toolCall.function.arguments || "{}",
      }));

      return {
        text: message.content ?? undefined,
        toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
        finishReason: toFinishReason(choice?.finish_reason),
        usage: {
          promptTokens: payload.usage?.prompt_tokens ?? 0,
          completionTokens: payload.usage?.completion_tokens ?? 0,
        },
        rawCall: {
          rawPrompt: body.messages,
          rawSettings: body,
        },
        rawResponse: {
          headers: responseHeaders,
          body: payload,
        },
        request: {
          body: JSON.stringify(body),
        },
        response: {
          id: payload.id,
          timestamp: payload.created ? new Date(payload.created * 1000) : undefined,
          modelId: payload.model,
        },
        providerMetadata: {
          openrouter: {
            cachedTokens: payload.usage?.prompt_tokens_details?.cached_tokens ?? 0,
            cacheWriteTokens: payload.usage?.prompt_tokens_details?.cache_write_tokens ?? 0,
            cacheControlApplied: Boolean(body.cache_control),
          },
        },
        warnings: [],
      };
    },
    async doStream() {
      throw new Error("Streaming is not implemented for the OpenRouter CLI adapter");
    },
  };
}

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

function buildOpenRouterChatBody(input: {
  model: string;
  options: LanguageModelCallOptions;
  enablePromptCaching: boolean;
}) {
  const tools = input.options.mode?.type === "regular"
    ? input.options.mode.tools?.filter(isFunctionTool)
    : undefined;

  const body: Record<string, unknown> = {
    model: input.model,
    messages: input.options.prompt.flatMap(toOpenRouterMessage).filter(Boolean),
    temperature: input.options.temperature,
    max_tokens: input.options.maxTokens,
    top_p: input.options.topP,
    frequency_penalty: input.options.frequencyPenalty,
    presence_penalty: input.options.presencePenalty,
    stop: input.options.stopSequences,
    tools: tools?.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    })),
    tool_choice: toOpenRouterToolChoice(input.options.mode?.toolChoice),
  };

  if (input.options.responseFormat?.type === "json") {
    body.response_format = { type: "json_object" };
  }

  if (input.enablePromptCaching && shouldApplyExplicitPromptCache(input.model)) {
    body.cache_control = { type: "ephemeral" };
  }

  return removeUndefined(body);
}

function toOpenRouterMessage(message: PromptMessage) {
  if (message.role === "system") {
    return { role: "system", content: message.content };
  }

  if (message.role === "user") {
    return { role: "user", content: textFromParts(message.content) };
  }

  if (message.role === "assistant") {
    const text = textFromParts(message.content);
    const toolCalls = message.content
      ?.filter(isToolCallPart)
      .map((part) => ({
        id: part.toolCallId,
        type: "function",
        function: {
          name: part.toolName,
          arguments: JSON.stringify(part.args ?? {}),
        },
      }));

    return removeUndefined({
      role: "assistant",
      content: text || null,
      tool_calls: toolCalls?.length ? toolCalls : undefined,
    });
  }

  if (message.role === "tool") {
    return message.content?.map((part) => ({
      role: "tool",
      tool_call_id: part.toolCallId,
      name: part.toolName,
      content: JSON.stringify(part.result ?? null),
    }));
  }

  return undefined;
}

function textFromParts(content: unknown) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter(isTextPart)
    .map((part) => part.text)
    .join("\n");
}

function toOpenRouterToolChoice(toolChoice: ToolChoice | undefined) {
  if (!toolChoice) return undefined;
  if (toolChoice.type === "auto" || toolChoice.type === "none" || toolChoice.type === "required") {
    return toolChoice.type;
  }
  if (toolChoice.type === "tool") {
    return { type: "function", function: { name: toolChoice.toolName } };
  }
  return undefined;
}

function toFinishReason(value: string | null | undefined) {
  if (value === "stop") return "stop";
  if (value === "length") return "length";
  if (value === "content_filter") return "content-filter";
  if (value === "tool_calls") return "tool-calls";
  return value ? "other" : "unknown";
}

function shouldApplyExplicitPromptCache(model: string) {
  const normalized = model.toLowerCase();
  return normalized.includes("anthropic") || normalized.includes("claude");
}

function removeUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}

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
  responseFormat?: { type: "text" | "json" };
  mode?: {
    type: string;
    tools?: ToolDefinition[];
    toolChoice?: ToolChoice;
  };
};

type PromptMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: unknown }
  | { role: "assistant"; content?: unknown[] }
  | { role: "tool"; content?: ToolResultPart[] };

type ToolDefinition = {
  type: string;
  name: string;
  description?: string;
  parameters: unknown;
};

type ToolChoice =
  | { type: "auto" | "none" | "required" }
  | { type: "tool"; toolName: string };

type TextPart = {
  type: "text";
  text: string;
};

type ToolCallPart = {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  args?: unknown;
};

type ToolResultPart = {
  toolCallId: string;
  toolName: string;
  result?: unknown;
};

function isFunctionTool(tool: ToolDefinition): tool is ToolDefinition & { type: "function" } {
  return tool.type === "function";
}

function isTextPart(part: unknown): part is TextPart {
  return isRecord(part) && part.type === "text" && typeof part.text === "string";
}

function isToolCallPart(part: unknown): part is ToolCallPart {
  return (
    isRecord(part) &&
    part.type === "tool-call" &&
    typeof part.toolCallId === "string" &&
    typeof part.toolName === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

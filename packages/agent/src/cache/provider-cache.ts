export type ProviderCacheSettings = {
  enableProviderPromptCaching: boolean;
  providerOptions: Record<string, unknown>;
  note: string;
};

export function buildProviderCacheSettings(input: {
  model: string;
  enabled: boolean;
}): ProviderCacheSettings {
  if (!input.enabled) {
    return {
      enableProviderPromptCaching: false,
      providerOptions: {},
      note: "disabled",
    };
  }

  return {
    enableProviderPromptCaching: true,
    providerOptions: {
      gateway: {
        caching: "auto",
      },
    },
    note: shouldUseExplicitOpenRouterCacheControl(input.model)
      ? "explicit-cache-control-for-openrouter-compatible-anthropic-route"
      : "provider-automatic-or-gateway-auto-cache",
  };
}

export function readProviderCacheDiagnostics(result: unknown) {
  const anyResult = result as {
    providerMetadata?: Record<string, Record<string, unknown>>;
    response?: { headers?: Record<string, string> };
    usage?: unknown;
  };

  return {
    providerMetadata: anyResult.providerMetadata ?? {},
    responseHeaders: {
      "x-openrouter-cache-status": anyResult.response?.headers?.["x-openrouter-cache-status"],
    },
    usage: anyResult.usage,
  };
}

function shouldUseExplicitOpenRouterCacheControl(model: string) {
  const normalized = model.toLowerCase();
  return normalized.includes("anthropic") || normalized.includes("claude");
}

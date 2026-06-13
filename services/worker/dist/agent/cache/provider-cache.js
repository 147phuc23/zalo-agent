export function buildProviderCacheSettings(input) {
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
export function readProviderCacheDiagnostics(result) {
    const anyResult = result;
    return {
        providerMetadata: anyResult.providerMetadata ?? {},
        responseHeaders: {
            "x-openrouter-cache-status": anyResult.response?.headers?.["x-openrouter-cache-status"],
        },
        usage: anyResult.usage,
    };
}
function shouldUseExplicitOpenRouterCacheControl(model) {
    const normalized = model.toLowerCase();
    return normalized.includes("anthropic") || normalized.includes("claude");
}

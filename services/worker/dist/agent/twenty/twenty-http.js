import { normalizeTwentyBaseUrl } from "./twenty-env.js";
/**
 * Low-level HTTP client for Twenty REST APIs (core `/rest/...` and metadata `/rest/metadata/...`).
 * Does not interpret record shapes — use recruiting-client / mappers for domain types.
 */
export async function twentyHttpJson(input) {
    const root = normalizeTwentyBaseUrl(input.baseUrl);
    const path = input.request.path.startsWith("/") ? input.request.path : `/${input.request.path}`;
    const url = new URL(`${root}${path}`);
    if (input.request.query) {
        for (const [key, value] of Object.entries(input.request.query)) {
            if (value !== undefined && value !== "") {
                url.searchParams.set(key, value);
            }
        }
    }
    const method = input.request.method ?? "GET";
    const headers = {
        authorization: `Bearer ${input.apiKey}`,
        accept: "application/json",
    };
    const init = {
        method,
        headers,
        signal: input.request.signal,
    };
    if (input.request.body !== undefined && method !== "GET" && method !== "DELETE") {
        headers["content-type"] = "application/json";
        init.body = JSON.stringify(input.request.body);
    }
    let attempt = 0;
    const maxAttempts = 15;
    while (attempt < maxAttempts) {
        const response = await fetch(url, init);
        if (response.status === 429) {
            attempt++;
            const retryAfterHeader = response.headers.get("retry-after");
            const delayMs = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : 5000;
            console.warn(`[twentyHttpJson] Rate limit hit (429). Retrying in ${delayMs}ms (attempt ${attempt}/${maxAttempts})…`);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            continue;
        }
        const text = await response.text();
        const payload = text ? safeJsonParse(text) : null;
        if (!response.ok) {
            throw new TwentyHttpError({
                method,
                url: url.toString(),
                status: response.status,
                body: payload ?? text,
            });
        }
        return payload;
    }
    throw new Error(`[twentyHttpJson] Max retry attempts (${maxAttempts}) reached due to rate limit.`);
}
function safeJsonParse(text) {
    try {
        return JSON.parse(text);
    }
    catch {
        return text;
    }
}
export class TwentyHttpError extends Error {
    method;
    url;
    status;
    responseBody;
    constructor(input) {
        super(`Twenty HTTP ${input.method} ${input.url} failed with ${input.status}: ${JSON.stringify(input.body)}`);
        this.method = input.method;
        this.url = input.url;
        this.status = input.status;
        this.responseBody = input.body;
    }
}

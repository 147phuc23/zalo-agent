import { normalizeTwentyBaseUrl } from "./twenty-env.js";

export type TwentyHttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export type TwentyRequestOptions = {
  path: string;
  method?: TwentyHttpMethod;
  query?: Record<string, string | undefined>;
  body?: unknown;
  signal?: AbortSignal;
};

/**
 * Low-level HTTP client for Twenty REST APIs (core `/rest/...` and metadata `/rest/metadata/...`).
 * Does not interpret record shapes — use recruiting-client / mappers for domain types.
 */
export async function twentyHttpJson<T>(input: {
  baseUrl: string;
  apiKey: string;
  request: TwentyRequestOptions;
}): Promise<T> {
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
  const headers: Record<string, string> = {
    authorization: `Bearer ${input.apiKey}`,
    accept: "application/json",
  };

  const init: RequestInit = {
    method,
    headers,
    signal: input.request.signal,
  };

  if (input.request.body !== undefined && method !== "GET" && method !== "DELETE") {
    headers["content-type"] = "application/json";
    init.body = JSON.stringify(input.request.body);
  }

  const response = await fetch(url, init);
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

  return payload as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export class TwentyHttpError extends Error {
  readonly method: string;
  readonly url: string;
  readonly status: number;
  readonly responseBody: unknown;

  constructor(input: { method: string; url: string; status: number; body: unknown }) {
    super(`Twenty HTTP ${input.method} ${input.url} failed with ${input.status}: ${JSON.stringify(input.body)}`);
    this.method = input.method;
    this.url = input.url;
    this.status = input.status;
    this.responseBody = input.body;
  }
}

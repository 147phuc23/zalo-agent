import { NextResponse } from "next/server";

/**
 * Shared helper for the admin's server-side API routes that proxy to the
 * platform API (`API_BASE_URL`). Centralises auth, logging, and robust
 * response handling so failures show up clearly in the Vercel function logs
 * instead of throwing unhandled / returning opaque 500s.
 */
export async function proxyToApi(
  label: string,
  path: string,
  init: RequestInit = {},
): Promise<NextResponse> {
  const apiBaseUrl = process.env.API_BASE_URL;
  const token = process.env.INTERNAL_INGEST_TOKEN;

  if (!apiBaseUrl || !token) {
    console.error(
      `[${label}] missing env: API_BASE_URL=${Boolean(apiBaseUrl)} INTERNAL_INGEST_TOKEN=${Boolean(token)}`,
    );
    return NextResponse.json(
      { ok: false, error: "missing env API_BASE_URL/INTERNAL_INGEST_TOKEN" },
      { status: 500 },
    );
  }

  const url = new URL(path, apiBaseUrl);
  const method = init.method ?? "GET";

  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);

  console.log(`[${label}] → ${method} ${url.toString()}`);

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers, cache: "no-store" });
  } catch (err: unknown) {
    const detail = err instanceof Error ? (err.stack ?? err.message) : String(err);
    console.error(`[${label}] fetch to ${url.toString()} failed:`, detail);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }

  // Read as text first — upstream may return non-JSON (e.g. a crash page or 404 HTML).
  const raw = await res.text();
  let body: unknown;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = { ok: false, error: "upstream returned non-JSON response", raw };
  }

  if (res.ok) {
    console.log(`[${label}] ← ${res.status} ${url.pathname}`);
  } else {
    console.error(
      `[${label}] upstream ${res.status} ${res.statusText} from ${url.toString()}: ${raw}`,
    );
  }

  return NextResponse.json(body, { status: res.status });
}

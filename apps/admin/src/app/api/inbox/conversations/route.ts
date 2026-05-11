import { NextResponse } from "next/server";

export async function GET() {
  const apiBaseUrl = process.env.API_BASE_URL;
  const token = process.env.INTERNAL_INGEST_TOKEN;
  const tenantId = process.env.TENANT_ID;

  if (!apiBaseUrl || !token || !tenantId) {
    return NextResponse.json(
      { ok: false, error: "missing env API_BASE_URL/INTERNAL_INGEST_TOKEN/TENANT_ID" },
      { status: 500 },
    );
  }

  const url = new URL("/internal/conversations", apiBaseUrl);
  url.searchParams.set("tenantId", tenantId);
  url.searchParams.set("limit", "50");

  const res = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}

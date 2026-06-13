import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const apiBaseUrl = process.env.API_BASE_URL;
  const token = process.env.INTERNAL_INGEST_TOKEN;
  const tenantId = process.env.TENANT_ID;

  if (!apiBaseUrl || !token || !tenantId) {
    return NextResponse.json(
      { ok: false, error: "missing env API_BASE_URL/INTERNAL_INGEST_TOKEN/TENANT_ID" },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key") ?? "assistant";
  const listAll = searchParams.get("listAll") ?? "false";

  const url = new URL("/internal/prompts", apiBaseUrl);
  url.searchParams.set("tenantId", tenantId);
  url.searchParams.set("key", key);
  url.searchParams.set("listAll", listAll);

  const res = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const body = await res.json();
  return NextResponse.json(body, { status: res.status });
}

export async function POST(req: Request) {
  const apiBaseUrl = process.env.API_BASE_URL;
  const token = process.env.INTERNAL_INGEST_TOKEN;
  const tenantId = process.env.TENANT_ID;

  if (!apiBaseUrl || !token || !tenantId) {
    return NextResponse.json(
      { ok: false, error: "missing env API_BASE_URL/INTERNAL_INGEST_TOKEN/TENANT_ID" },
      { status: 500 },
    );
  }

  try {
    const body = await req.json();
    const url = new URL("/internal/prompts", apiBaseUrl);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        tenantId,
        key: body.key ?? "assistant",
        content: body.content,
      }),
    });

    const resBody = await res.json();
    return NextResponse.json(resBody, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

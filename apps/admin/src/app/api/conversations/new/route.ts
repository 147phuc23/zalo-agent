import { NextResponse } from "next/server";

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

  const url = new URL("/internal/conversations/new", apiBaseUrl);

  try {
    const body = await req.json();

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        tenantId,
        channel: body.channel ?? "zalo",
        externalThreadId: body.externalThreadId,
        externalUserId: body.externalUserId,
        displayName: body.displayName ?? null,
      }),
    });

    // Read as text first — upstream may return non-JSON (e.g. a 500 crash page).
    const raw = await res.text();
    let resBody: unknown;
    try {
      resBody = JSON.parse(raw);
    } catch {
      resBody = { ok: false, error: "upstream returned non-JSON response", raw };
    }

    if (!res.ok) {
      console.error(
        `[api/conversations/new] upstream ${res.status} ${res.statusText} from ${url.toString()}:`,
        raw,
      );
    }

    return NextResponse.json(resBody, { status: res.status });
  } catch (err: any) {
    console.error(
      `[api/conversations/new] request to ${url.toString()} failed:`,
      err?.stack ?? err?.message ?? err,
    );
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}

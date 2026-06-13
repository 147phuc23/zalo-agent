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

  try {
    const body = await req.json();
    const url = new URL("/internal/events", apiBaseUrl);

    // Create a unique idempotency key for this simulated message
    const idempotencyKey = `${body.threadId}:${Date.now()}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        events: [
          {
            kind: "message.received",
            tenantId,
            channel: body.channel ?? "zalo",
            threadId: body.threadId,
            senderExternalId: body.senderExternalId ?? "zalo-candidate-frontend",
            messageType: "text",
            text: body.text,
            receivedAt: new Date().toISOString(),
            idempotencyKey,
            rawPayload: { source: "zalo-simulator", context: body.context ?? {} },
          },
        ],
      }),
    });

    const resBody = await res.json();
    return NextResponse.json(resBody, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

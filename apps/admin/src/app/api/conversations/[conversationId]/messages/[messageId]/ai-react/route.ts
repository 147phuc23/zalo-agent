import { NextResponse } from "next/server";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ conversationId: string; messageId: string }> },
) {
  const { conversationId, messageId } = await params;
  const apiBaseUrl = process.env.API_BASE_URL;
  const token = process.env.INTERNAL_INGEST_TOKEN;

  if (!apiBaseUrl || !token) {
    return NextResponse.json(
      { ok: false, error: "missing env API_BASE_URL/INTERNAL_INGEST_TOKEN" },
      { status: 500 },
    );
  }

  let reqBody: any = undefined;
  try {
    reqBody = await _req.json();
  } catch (e) {
    // body is optional or empty
  }

  try {
    const url = new URL(`/internal/conversations/${conversationId}/messages/${messageId}/ai-react`, apiBaseUrl);
    const res = await fetch(url, {
      method: "POST",
      headers: { 
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: reqBody ? JSON.stringify(reqBody) : undefined,
    });

    const body = await res.json();
    return NextResponse.json(body, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

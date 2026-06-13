import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await params;
  const apiBaseUrl = process.env.API_BASE_URL;
  const token = process.env.INTERNAL_INGEST_TOKEN;

  if (!apiBaseUrl || !token) {
    return NextResponse.json(
      { ok: false, error: "missing env API_BASE_URL/INTERNAL_INGEST_TOKEN" },
      { status: 500 },
    );
  }

  try {
    const body = await req.json();
    const url = new URL(`/internal/conversations/${conversationId}/model`, apiBaseUrl);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ model: body.model }),
    });

    const resBody = await res.json();
    return NextResponse.json(resBody, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";

export async function GET(
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

  const url = new URL(`/internal/conversations/${conversationId}/audits`, apiBaseUrl);

  const res = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const body = await res.json();
  return NextResponse.json(body, { status: res.status });
}

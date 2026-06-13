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

  const url = new URL(`/internal/conversations/${conversationId}/read`, apiBaseUrl);

  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });

  const body = await res.json();
  return NextResponse.json(body, { status: res.status });
}

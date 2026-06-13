import { NextResponse } from "next/server";

export async function GET() {
  const apiBaseUrl = process.env.API_BASE_URL;
  const token = process.env.INTERNAL_INGEST_TOKEN;

  if (!apiBaseUrl || !token) {
    return NextResponse.json(
      { ok: false, error: "missing env API_BASE_URL/INTERNAL_INGEST_TOKEN" },
      { status: 500 },
    );
  }

  try {
    const url = new URL("/internal/models", apiBaseUrl);
    const res = await fetch(url, {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    const resBody = await res.json();
    return NextResponse.json(resBody, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

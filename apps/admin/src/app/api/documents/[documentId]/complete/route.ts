import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params;
  const apiBaseUrl = process.env.API_BASE_URL;
  const token = process.env.INTERNAL_INGEST_TOKEN;
  const tenantId = process.env.TENANT_ID;

  if (!apiBaseUrl || !token || !tenantId) {
    return NextResponse.json(
      { ok: false, error: "missing env config" },
      { status: 500 }
    );
  }

  try {
    // Trigger internal processing
    const processUrl = new URL("/internal/documents/process", apiBaseUrl);
    const processRes = await fetch(processUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        tenantId,
        documentId,
      }),
    });

    if (!processRes.ok) {
      const errText = await processRes.text();
      return NextResponse.json(
        { ok: false, error: `Failed to trigger processing: ${errText}` },
        { status: processRes.status }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

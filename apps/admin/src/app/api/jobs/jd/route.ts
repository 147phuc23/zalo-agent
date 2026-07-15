import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { createStorage } from "@platform/storage";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const tenantId = process.env.TENANT_ID;
  const apiBaseUrl = process.env.API_BASE_URL;
  const token = process.env.INTERNAL_INGEST_TOKEN;

  if (!tenantId || !apiBaseUrl || !token) {
    return NextResponse.json(
      { ok: false, error: "missing env config" },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const { companyId, fileName, mimeType, pastedText } = body;

    if (!companyId) {
      return NextResponse.json(
        { ok: false, error: "companyId is required" },
        { status: 400 }
      );
    }

    const repos = getRepos();

    if (pastedText) {
      // Immediate process for pasted text
      const doc = await repos.documents.create({
        tenantId,
        kind: "jd",
        storageKey: `pasted-${Date.now()}`,
        fileName: "pasted-jd.txt",
        mimeType: "text/plain",
        sizeBytes: Buffer.byteLength(pastedText, "utf-8"),
        companyId,
        uploadedBy: "admin",
      });

      // Update the document to mark raw text
      await repos.documents.markProcessed({
        id: doc.id,
        rawText: pastedText,
        parseMethod: "plain-text",
      });

      // Trigger internal process worker
      const processUrl = new URL("/internal/documents/process", apiBaseUrl);
      const processRes = await fetch(processUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tenantId,
          documentId: doc.id,
        }),
      });

      if (!processRes.ok) {
        const errText = await processRes.text();
        return NextResponse.json(
          { ok: false, error: `Failed to enqueue processing: ${errText}` },
          { status: processRes.status }
        );
      }

      return NextResponse.json({ ok: true, documentId: doc.id });
    } else {
      // File upload flow: generate uploadUrl
      if (!fileName) {
        return NextResponse.json(
          { ok: false, error: "fileName is required for file uploads" },
          { status: 400 }
        );
      }

      const documentId = crypto.randomUUID();
      const storageKey = `${tenantId}/jd/${documentId}/${fileName}`;

      const doc = await repos.documents.create({
        tenantId,
        kind: "jd",
        storageKey,
        fileName,
        mimeType: mimeType || "application/octet-stream",
        companyId,
        uploadedBy: "admin",
      });

      const storage = createStorage(process.env);
      const uploadTarget = await storage.getUploadTarget({
        key: storageKey,
        contentType: mimeType || "application/octet-stream",
        documentId: doc.id,
      });

      return NextResponse.json({
        ok: true,
        documentId: doc.id,
        uploadUrl: uploadTarget.url,
      });
    }
  } catch (err: any) {
    console.error("[api/jobs/jd] POST failed:", err);
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}

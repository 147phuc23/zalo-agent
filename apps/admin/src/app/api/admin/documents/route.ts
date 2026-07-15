import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { createStorage } from "@platform/storage";
import crypto from "node:crypto";

export const runtime = "nodejs";

export async function GET() {
  const tenantId = process.env.TENANT_ID;
  if (!tenantId) {
    return NextResponse.json({ ok: false, error: "missing TENANT_ID" }, { status: 500 });
  }
  try {
    const docs = await getRepos().documents.listByTenant({ tenantId, limit: 100 });
    return NextResponse.json({ ok: true, documents: docs });
  } catch (err) {
    console.error("[api/admin/documents] GET failed:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const tenantId = process.env.TENANT_ID;
  if (!tenantId) {
    return NextResponse.json({ ok: false, error: "missing TENANT_ID" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { fileName, mimeType, kind, contactId, guestAccessId, conversationId, companyId, uploadedBy } = body;

    if (!fileName || !kind) {
      return NextResponse.json({ ok: false, error: "fileName and kind are required" }, { status: 400 });
    }

    if (kind !== "cv" && kind !== "jd") {
      return NextResponse.json({ ok: false, error: "kind must be either 'cv' or 'jd'" }, { status: 400 });
    }

    const documentId = crypto.randomUUID();
    const storageKey = `${tenantId}/${kind}/${documentId}/${fileName}`;

    const doc = await getRepos().documents.create({
      tenantId,
      kind,
      storageKey,
      fileName,
      mimeType: mimeType || "application/octet-stream",
      contactId,
      guestAccessId,
      conversationId,
      companyId,
      uploadedBy: uploadedBy || "admin",
    });

    const storage = createStorage();
    const uploadTarget = await storage.getUploadTarget({
      key: storageKey,
      contentType: mimeType || "application/octet-stream",
      documentId: doc.id,
    });

    return NextResponse.json({
      ok: true,
      uploadTarget,
      documentId: doc.id,
    });
  } catch (err) {
    console.error("[api/admin/documents] POST failed:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { Queue } from "bullmq";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const tenantId = process.env.TENANT_ID;
  if (!tenantId) {
    return NextResponse.json({ ok: false, error: "missing TENANT_ID" }, { status: 500 });
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return NextResponse.json({ ok: false, error: "missing REDIS_URL" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { documentId } = body;

    if (!documentId) {
      return NextResponse.json({ ok: false, error: "documentId is required" }, { status: 400 });
    }

    const doc = await getRepos().documents.findById(documentId);
    if (!doc) {
      return NextResponse.json({ ok: false, error: "Document not found" }, { status: 404 });
    }

    const processQueue = new Queue("document.process", {
      connection: { url: redisUrl },
    });

    await processQueue.add("document.process", {
      tenantId,
      documentId,
    });

    await processQueue.close();

    return NextResponse.json({
      ok: true,
      message: "Processing enqueued successfully",
      documentId,
    });
  } catch (err) {
    console.error("[api/admin/documents/process] POST failed:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

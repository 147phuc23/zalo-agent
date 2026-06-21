import { NextResponse } from "next/server";
import { ingestInboundMessage, generateAndSaveReply } from "@platform/core";
import { getRepos } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60; // agent reply can take a while

export async function POST(req: Request) {
  const tenantId = process.env.TENANT_ID;
  if (!tenantId) {
    return NextResponse.json({ ok: false, error: "missing env TENANT_ID" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const repos = getRepos();
    const idempotencyKey = body.idempotencyKey ?? `${body.threadId}:${Date.now()}`;

    const ingest = await ingestInboundMessage(repos, {
      tenantId,
      channel: body.channel ?? "zalo",
      threadId: body.threadId,
      senderExternalId: body.senderExternalId ?? "zalo-candidate-frontend",
      messageType: "text",
      text: body.text,
      idempotencyKey,
      rawPayload: { source: "zalo-simulator", context: body.context ?? {} },
      receivedAt: new Date().toISOString(),
    });

    if (ingest.status === "duplicate") {
      return NextResponse.json({ ok: true, status: "duplicate", conversationId: ingest.conversationId });
    }

    // Generate the agent reply inline (best-effort — a reply failure must not fail ingest).
    let drafts;
    try {
      drafts = await generateAndSaveReply(repos, {
        tenantId,
        conversationId: ingest.conversationId,
        targetMessageId: ingest.messageId,
      });
    } catch (replyErr: any) {
      console.error("[api/events] reply generation failed:", replyErr?.stack ?? replyErr);
    }

    return NextResponse.json({
      ok: true,
      status: "stored",
      conversationId: ingest.conversationId,
      messageId: ingest.messageId,
      drafts,
    });
  } catch (err: any) {
    console.error("[api/events] failed:", err?.stack ?? err);
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}

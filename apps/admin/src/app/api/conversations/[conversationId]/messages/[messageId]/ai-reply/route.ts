import { NextResponse } from "next/server";
import { generateAndSaveReply } from "@platform/core";
import { getRepos } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60; // 60s limit on Vercel Hobby

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ conversationId: string; messageId: string }> },
) {
  const { conversationId, messageId } = await params;
  const tenantId = process.env.TENANT_ID;
  if (!tenantId) {
    return NextResponse.json(
      { ok: false, error: "missing env TENANT_ID" },
      { status: 500 },
    );
  }

  try {
    const drafts = await generateAndSaveReply(getRepos(), {
      tenantId,
      conversationId,
      targetMessageId: messageId,
    });
    return NextResponse.json({ ok: true, drafts });
  } catch (err: any) {
    console.error("[ai-reply] failed:", err?.stack ?? err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}

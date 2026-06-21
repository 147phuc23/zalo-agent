import { NextResponse } from "next/server";
import { generateAndSaveReaction } from "@platform/core";
import { getRepos } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60; // 60s limit on Vercel Hobby

export async function POST(
  req: Request,
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
    const body = await req.json().catch(() => ({}));
    const message = await generateAndSaveReaction(getRepos(), {
      tenantId,
      conversationId,
      targetMessageId: messageId,
      reaction: body.reaction,
    });
    return NextResponse.json({ ok: true, message });
  } catch (err: any) {
    console.error("[ai-react] failed:", err?.stack ?? err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}

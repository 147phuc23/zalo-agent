import { NextResponse } from "next/server";
import { createConversation } from "@platform/core";
import { getRepos } from "@/lib/db";

export const runtime = "nodejs"; // REQUIRED: pg does not run on Edge

export async function POST(req: Request) {
  const tenantId = process.env.TENANT_ID;
  if (!tenantId) {
    return NextResponse.json(
      { ok: false, error: "missing env TENANT_ID" },
      { status: 500 },
    );
  }

  try {
    const body = await req.json();
    const channel = body.channel ?? "zalo";
    const externalThreadId = body.externalThreadId;
    const externalUserId = body.externalUserId;
    const displayName = body.displayName ?? null;

    if (!externalThreadId || !externalUserId) {
      return NextResponse.json(
        { ok: false, error: "Missing externalThreadId or externalUserId" },
        { status: 400 },
      );
    }

    const repos = getRepos();
    const result = await createConversation(repos, {
      tenantId,
      channel,
      externalThreadId,
      externalUserId,
      displayName,
    });

    return NextResponse.json({ ok: true, conversationId: result.conversationId });
  } catch (err: any) {
    console.error("[api/conversations/new] failed:", err?.stack ?? err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}

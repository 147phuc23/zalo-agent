import { NextResponse } from "next/server";
import { listMessages } from "@platform/core";
import { getRepos } from "@/lib/db";

export const runtime = "nodejs"; // REQUIRED: pg does not run on Edge

export async function GET(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await params;
  const { searchParams } = new URL(req.url);
  const after = searchParams.get("after") || undefined;
  try {
    const messages = await listMessages(getRepos(), { conversationId, limit: 200, after });
    return NextResponse.json({ ok: true, messages });
  } catch (err: any) {
    console.error(`[api/inbox/messages] convId=${conversationId}`, err?.stack ?? err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

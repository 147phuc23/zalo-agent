import { NextResponse } from "next/server";
import { listMessages } from "@platform/core";
import { getRepos } from "@/lib/db";

export const runtime = "nodejs"; // REQUIRED: pg does not run on Edge

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await params;
  try {
    const messages = await listMessages(getRepos(), { conversationId, limit: 200 });
    return NextResponse.json({ ok: true, messages });
  } catch (err: any) {
    console.error(`[api/inbox/messages] convId=${conversationId}`, err?.stack ?? err);
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";

export const runtime = "nodejs"; // REQUIRED: pg does not run on Edge

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await params;
  try {
    const audits = await getRepos().audits.listByConversation(conversationId);
    return NextResponse.json({ ok: true, audits });
  } catch (err: any) {
    console.error(`[api/conversations/audits] convId=${conversationId}`, err?.stack ?? err);
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}

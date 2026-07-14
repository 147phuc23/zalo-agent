import { NextResponse } from "next/server";
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
    const audits = await getRepos().audits.listByConversation(conversationId, after);
    return NextResponse.json({ ok: true, audits });
  } catch (err: any) {
    console.error(`[api/conversations/audits] convId=${conversationId}`, err?.stack ?? err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

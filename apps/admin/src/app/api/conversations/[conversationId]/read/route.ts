import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";

export const runtime = "nodejs"; // REQUIRED: pg does not run on Edge

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await params;
  try {
    await getRepos().messages.markAsRead(conversationId);
    return NextResponse.json({ ok: true, read: true });
  } catch (err: any) {
    console.error(`[api/conversations/read] convId=${conversationId}`, err?.stack ?? err);
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}

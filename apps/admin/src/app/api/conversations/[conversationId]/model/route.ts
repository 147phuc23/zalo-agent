import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";

export const runtime = "nodejs"; // REQUIRED: pg does not run on Edge

export async function POST(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await params;
  try {
    const body = await req.json().catch(() => ({}));
    await getRepos().conversations.updateOverrideModel(conversationId, body.model);
    return NextResponse.json({ ok: true, updated: true });
  } catch (err: any) {
    console.error(`[api/conversations/model] convId=${conversationId}`, err?.stack ?? err);
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}

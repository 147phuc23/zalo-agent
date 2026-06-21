import { NextResponse } from "next/server";
import { listConversations } from "@platform/core";
import { getRepos } from "@/lib/db";

export const runtime = "nodejs"; // REQUIRED: pg does not run on Edge

export async function GET() {
  const tenantId = process.env.TENANT_ID;
  if (!tenantId) {
    console.error("[api/inbox/conversations] missing env TENANT_ID");
    return NextResponse.json({ ok: false, error: "missing env TENANT_ID" }, { status: 500 });
  }

  try {
    const conversations = await listConversations(getRepos(), { tenantId, limit: 50 });
    return NextResponse.json({ ok: true, conversations });
  } catch (err: any) {
    console.error("[api/inbox/conversations]", err?.stack ?? err);
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}

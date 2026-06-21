import { NextResponse } from "next/server";
import { proxyToApi } from "@/lib/api-proxy";

export async function GET() {
  const tenantId = process.env.TENANT_ID;
  if (!tenantId) {
    console.error("[api/inbox/conversations] missing env TENANT_ID");
    return NextResponse.json({ ok: false, error: "missing env TENANT_ID" }, { status: 500 });
  }

  const qs = new URLSearchParams({ tenantId, limit: "50" });
  return proxyToApi("api/inbox/conversations", `/internal/conversations?${qs.toString()}`);
}

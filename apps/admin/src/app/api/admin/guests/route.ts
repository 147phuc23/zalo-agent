import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { createInvite } from "@platform/core";

export const runtime = "nodejs";

export async function GET() {
  const tenantId = process.env.TENANT_ID;
  if (!tenantId) {
    return NextResponse.json({ ok: false, error: "missing TENANT_ID" }, { status: 500 });
  }
  try {
    const guests = await getRepos().guestAccess.listByTenant({ tenantId, limit: 100 });
    return NextResponse.json({ ok: true, guests });
  } catch (err) {
    console.error("[api/admin/guests] GET failed:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST() {
  const tenantId = process.env.TENANT_ID;
  if (!tenantId) {
    return NextResponse.json({ ok: false, error: "missing TENANT_ID" }, { status: 500 });
  }
  try {
    const guest = await createInvite(getRepos(), { tenantId });
    return NextResponse.json({ ok: true, guest });
  } catch (err) {
    console.error("[api/admin/guests] POST failed:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

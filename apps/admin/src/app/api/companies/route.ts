import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const tenantId = process.env.TENANT_ID;
  if (!tenantId) {
    return NextResponse.json(
      { ok: false, error: "missing env TENANT_ID" },
      { status: 500 }
    );
  }

  try {
    const repos = getRepos();
    const companies = await repos.companies.listAll({ tenantId });
    return NextResponse.json({ ok: true, companies });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}

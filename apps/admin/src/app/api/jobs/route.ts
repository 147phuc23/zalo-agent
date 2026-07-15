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

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as "draft" | "active" | "archived" | null;

  try {
    const repos = getRepos();
    if (status) {
      const jobs = await repos.jobs.listByStatus({ tenantId, status });
      return NextResponse.json({ ok: true, jobs });
    } else {
      // Return active by default
      const jobs = await repos.jobs.listActive({ tenantId });
      return NextResponse.json({ ok: true, jobs });
    }
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}

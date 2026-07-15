import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { createDatabaseClient } from "@platform/database";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const tenantId = process.env.TENANT_ID;
  const dbUrl = process.env.PLATFORM_DB_URL;
  if (!tenantId || !dbUrl) {
    return NextResponse.json(
      { ok: false, error: "missing env TENANT_ID or PLATFORM_DB_URL" },
      { status: 500 }
    );
  }

  const client = createDatabaseClient({ PLATFORM_DB_URL: dbUrl });
  try {
    const res = await client.query(
      `SELECT kg.*, c.name AS company_name
       FROM public.knowledge_gaps kg
       LEFT JOIN public.companies c ON kg.company_id = c.id
       WHERE kg.tenant_id = $1
       ORDER BY kg.status ASC, kg.ask_count DESC, kg.created_at DESC`,
      [tenantId]
    );
    return NextResponse.json({ ok: true, gaps: res.rows });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  } finally {
    await client.end();
  }
}

export async function POST(req: Request) {
  try {
    const repos = getRepos();
    const { gapId, answer } = await req.json();
    if (!gapId || !answer) {
      return NextResponse.json(
        { ok: false, error: "gapId and answer are required" },
        { status: 400 }
      );
    }

    await repos.knowledgeGaps.markAnswered({ id: gapId, answer });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
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
    // 1. Fetch candidate profiles
    const profilesRes = await client.query(
      `SELECT cp.*, co.display_name, co.phone AS contact_phone
       FROM public.candidate_profiles cp
       LEFT JOIN public.contacts co ON cp.contact_id = co.id
       WHERE cp.tenant_id = $1
       ORDER BY cp.created_at DESC`,
      [tenantId]
    );

    const profiles = profilesRes.rows;

    // 2. Fetch applications for each
    const appsRes = await client.query(
      `SELECT a.*, jp.title AS job_title, c.name AS company_name
       FROM public.applications a
       JOIN public.job_postings jp ON a.job_posting_id = jp.id
       LEFT JOIN public.companies c ON jp.company_id = c.id
       WHERE a.tenant_id = $1`,
      [tenantId]
    );
    const applications = appsRes.rows;

    // 3. Fetch change logs
    const logsRes = await client.query(
      `SELECT * FROM public.candidate_profile_change_logs
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [tenantId]
    );
    const changeLogs = logsRes.rows;

    // 4. Fetch risk signals
    const signalsRes = await client.query(
      `SELECT * FROM public.risk_signals
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [tenantId]
    );
    const riskSignals = signalsRes.rows;

    // Assemble everything
    const data = profiles.map((p) => {
      const pApps = applications.filter((a) => a.candidate_profile_id === p.id);
      const pLogs = changeLogs.filter((l) => l.candidate_profile_id === p.id);
      const pSignals = riskSignals.filter((s) => s.candidate_profile_id === p.id);

      return {
        ...p,
        applications: pApps,
        changeLogs: pLogs,
        riskSignals: pSignals,
      };
    });

    return NextResponse.json({ ok: true, candidates: data });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  } finally {
    await client.end();
  }
}

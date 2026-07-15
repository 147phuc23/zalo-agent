import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const repos = getRepos();
    await repos.jobs.setStatus({ id, status: "active" });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}

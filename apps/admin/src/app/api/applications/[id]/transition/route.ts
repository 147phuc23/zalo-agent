import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { toStage, toStatus, note } = await req.json();
    const repos = getRepos();
    const application = await repos.applications.transition({
      applicationId: id,
      toStage,
      toStatus,
      actorType: "admin",
      actorId: "admin-operator",
      note,
    });
    return NextResponse.json({ ok: true, application });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}

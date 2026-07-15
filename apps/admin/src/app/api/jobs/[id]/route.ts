import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await req.json();
    const { patch } = body;
    if (!patch) {
      return NextResponse.json(
        { ok: false, error: "patch object is required" },
        { status: 400 }
      );
    }

    const repos = getRepos();
    const updated = await repos.jobs.updateFields({ id, patch });
    return NextResponse.json({ ok: true, job: updated });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params;
  try {
    const guest = await getRepos().guestAccess.revoke(id);
    if (!guest) {
      return NextResponse.json({ ok: false, error: "Guest link not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, guest });
  } catch (err) {
    console.error("[api/admin/guests/revoke] POST failed:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

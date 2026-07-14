import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ code: string }>;
}

export async function GET(req: Request, { params }: RouteParams) {
  const { code } = await params;
  try {
    const guest = await getRepos().guestAccess.findByInviteCode(code);
    if (!guest) {
      return NextResponse.json({ ok: false, error: "Invite code not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, status: guest.status });
  } catch (err) {
    console.error(`[api/guest/state] code=${code}`, err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

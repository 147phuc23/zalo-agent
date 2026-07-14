import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { verifyGuestSession } from "@platform/core";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ code: string }>;
}

export async function GET(req: Request, { params }: RouteParams) {
  const { code } = await params;
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const secret = authHeader.slice("Bearer ".length).trim();

  try {
    const guest = await verifyGuestSession(getRepos(), code, secret);
    return NextResponse.json({ ok: true, guest });
  } catch (err: any) {
    console.error(`[api/guest/me] code=${code}`, err);
    return NextResponse.json({ ok: false, error: err.message || "Unauthorized" }, { status: 401 });
  }
}

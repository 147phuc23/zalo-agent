import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { claimInvite } from "@platform/core";
import { z } from "zod";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ code: string }>;
}

const ClaimBody = z.object({
  password: z.string().min(6).max(100),
  displayName: z.string().min(2).max(100),
  profile: z.object({
    desiredRole: z.string().optional(),
    experienceYears: z.coerce.number().optional(),
    expectedSalary: z.string().optional(),
  }).default({}),
});

export async function POST(req: Request, { params }: RouteParams) {
  const { code } = await params;
  try {
    const bodyResult = ClaimBody.safeParse(await req.json());
    if (!bodyResult.success) {
      return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
    }
    const { password, displayName, profile } = bodyResult.data;
    const { guest, secret } = await claimInvite(getRepos(), {
      inviteCode: code,
      password,
      displayName,
      profile,
    });
    return NextResponse.json({ ok: true, guest, secret });
  } catch (err: any) {
    console.error(`[api/guest/claim] code=${code}`, err);
    return NextResponse.json({ ok: false, error: err.message || "Internal server error" }, { status: 500 });
  }
}

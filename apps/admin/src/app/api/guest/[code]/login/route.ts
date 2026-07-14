import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { loginGuest } from "@platform/core";
import { z } from "zod";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ code: string }>;
}

const LoginBody = z.object({
  password: z.string().min(1),
});

export async function POST(req: Request, { params }: RouteParams) {
  const { code } = await params;
  try {
    const bodyResult = LoginBody.safeParse(await req.json());
    if (!bodyResult.success) {
      return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
    }
    const { guest, secret } = await loginGuest(getRepos(), {
      inviteCode: code,
      password: bodyResult.data.password,
    });
    return NextResponse.json({ ok: true, guest, secret });
  } catch (err: any) {
    console.error(`[api/guest/login] code=${code}`, err);
    return NextResponse.json({ ok: false, error: err.message || "Internal server error" }, { status: 401 });
  }
}

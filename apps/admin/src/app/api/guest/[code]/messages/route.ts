import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { verifyGuestSession, listGuestMessages, sendGuestMessage } from "@platform/core";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60; // Agent reply can take up to 60s

interface RouteParams {
  params: Promise<{ code: string }>;
}

async function getAuthenticatedGuest(req: Request, code: string) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  const secret = authHeader.slice("Bearer ".length).trim();
  try {
    return await verifyGuestSession(getRepos(), code, secret);
  } catch {
    return null;
  }
}

export async function GET(req: Request, { params }: RouteParams) {
  const { code } = await params;
  const guest = await getAuthenticatedGuest(req, code);
  if (!guest) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "100", 10), 1), 500);
  const after = searchParams.get("after") || undefined;

  try {
    const messages = await listGuestMessages(getRepos(), guest, { limit, after });
    return NextResponse.json({ ok: true, messages });
  } catch (err) {
    console.error(`[api/guest/messages] GET failed: code=${code}`, err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

const SendMessageSchema = z.object({
  text: z.string().min(1).max(5000),
});

export async function POST(req: Request, { params }: RouteParams) {
  const { code } = await params;
  const guest = await getAuthenticatedGuest(req, code);
  if (!guest) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const bodyResult = SendMessageSchema.safeParse(await req.json());
    if (!bodyResult.success) {
      return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
    }
    const result = await sendGuestMessage(getRepos(), guest, { text: bodyResult.data.text });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error(`[api/guest/messages] POST failed: code=${code}`, err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

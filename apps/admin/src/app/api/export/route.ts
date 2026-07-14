import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { content, filename } = await req.json();
    if (!content || !filename) {
      return NextResponse.json({ ok: false, error: "Missing content or filename" }, { status: 400 });
    }

    const headers = new Headers();
    headers.set("Content-Disposition", `attachment; filename="${filename}"`);
    headers.set("Content-Type", "text/markdown; charset=utf-8");

    return new Response(content, {
      status: 200,
      headers,
    });
  } catch (err: any) {
    console.error("[api/export] Error during session export", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getActivePrompt, listPromptVersions, saveNewPromptVersion } from "@platform/core";
import { getRepos } from "@/lib/db";

export const runtime = "nodejs"; // REQUIRED: pg does not run on Edge

export async function GET(req: Request) {
  const tenantId = process.env.TENANT_ID;
  if (!tenantId) {
    return NextResponse.json(
      { ok: false, error: "missing env TENANT_ID" },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key") ?? "assistant";
  const listAll = searchParams.get("listAll") ?? "false";

  try {
    const repos = getRepos();
    if (listAll === "true") {
      const versions = await listPromptVersions(repos, tenantId, key);
      return NextResponse.json({ ok: true, versions });
    } else {
      const active = await getActivePrompt(repos, tenantId, key);
      return NextResponse.json({ ok: true, active });
    }
  } catch (err: any) {
    console.error("[api/prompts] GET failed:", err?.stack ?? err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const tenantId = process.env.TENANT_ID;
  if (!tenantId) {
    return NextResponse.json(
      { ok: false, error: "missing env TENANT_ID" },
      { status: 500 },
    );
  }

  try {
    const body = await req.json();
    const key = body.key ?? "assistant";
    const content = body.content;
    if (typeof content !== "string") {
      return NextResponse.json(
        { ok: false, error: "content must be a string" },
        { status: 400 },
      );
    }

    const repos = getRepos();
    const newVersion = await saveNewPromptVersion(repos, tenantId, key, content);
    return NextResponse.json({ ok: true, prompt: newVersion });
  } catch (err: any) {
    console.error("[api/prompts] POST failed:", err?.stack ?? err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}

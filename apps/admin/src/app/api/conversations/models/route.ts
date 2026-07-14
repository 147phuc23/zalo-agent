import { NextResponse } from "next/server";

export async function GET() {
  const models = [
    { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" },
    { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro" },
    { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
    { id: "tencent/hy3:free", name: "OpenRouter Owl Alpha (Default)" },
  ];
  return NextResponse.json({ ok: true, models });
}

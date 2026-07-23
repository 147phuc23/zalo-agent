import { NextResponse } from "next/server";

export async function GET() {
  const models = [
    { id: "cohere/north-mini-code:free", name: "Cohere North Mini Code (Default)" },
    { id: "nvidia/nemotron-3-ultra-550b-a55b:free", name: "Nvidia Nemotron 3 Ultra 550B (Free)" },
    { id: "poolside/laguna-m.1:free", name: "Poolside Laguna M.1 (Free)" },
  ];
  return NextResponse.json({ ok: true, models });
}

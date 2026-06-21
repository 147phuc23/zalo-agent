import { proxyToApi } from "@/lib/api-proxy";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await params;
  const body = await req.json().catch(() => ({}));
  return proxyToApi(
    "api/conversations/model",
    `/internal/conversations/${conversationId}/model`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: body.model }),
    },
  );
}

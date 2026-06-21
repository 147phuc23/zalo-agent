import { proxyToApi } from "@/lib/api-proxy";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ conversationId: string; messageId: string }> },
) {
  const { conversationId, messageId } = await params;
  const reqBody = await req.json().catch(() => undefined);
  return proxyToApi(
    "api/conversations/ai-react",
    `/internal/conversations/${conversationId}/messages/${messageId}/ai-react`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: reqBody ? JSON.stringify(reqBody) : undefined,
    },
  );
}

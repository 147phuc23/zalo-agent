import { proxyToApi } from "@/lib/api-proxy";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ conversationId: string; messageId: string }> },
) {
  const { conversationId, messageId } = await params;
  return proxyToApi(
    "api/conversations/ai-reply",
    `/internal/conversations/${conversationId}/messages/${messageId}/ai-reply`,
    { method: "POST" },
  );
}

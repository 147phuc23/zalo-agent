import { proxyToApi } from "@/lib/api-proxy";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await params;
  return proxyToApi(
    "api/conversations/read",
    `/internal/conversations/${conversationId}/read`,
    { method: "POST" },
  );
}

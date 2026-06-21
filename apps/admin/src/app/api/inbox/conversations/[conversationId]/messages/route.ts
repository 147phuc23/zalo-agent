import { proxyToApi } from "@/lib/api-proxy";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await params;
  const qs = new URLSearchParams({ limit: "200" });
  return proxyToApi(
    "api/inbox/messages",
    `/internal/conversations/${conversationId}/messages?${qs.toString()}`,
  );
}

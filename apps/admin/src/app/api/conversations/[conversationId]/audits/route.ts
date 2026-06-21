import { proxyToApi } from "@/lib/api-proxy";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await params;
  return proxyToApi(
    "api/conversations/audits",
    `/internal/conversations/${conversationId}/audits`,
  );
}

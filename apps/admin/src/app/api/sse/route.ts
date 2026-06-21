// SSE is not supported on serverless (no long-lived connections, no cross-instance
// pub/sub). The admin uses polling instead (see page.tsx). This endpoint is kept as a
// harmless no-op so any stray EventSource client gets a clean, immediately-closing
// stream rather than hammering a crashing proxy.
export const runtime = "nodejs";

export async function GET() {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(": sse disabled; admin uses polling\n\n"));
      controller.close();
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

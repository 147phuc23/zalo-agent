import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const apiBaseUrl = process.env.API_BASE_URL;
  const token = process.env.INTERNAL_INGEST_TOKEN;

  if (!apiBaseUrl || !token) {
    return new Response("missing env API_BASE_URL/INTERNAL_INGEST_TOKEN", {
      status: 500,
    });
  }

  try {
    const url = new URL("/internal/sse", apiBaseUrl);
    const res = await fetch(url, {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "text/event-stream",
      },
    });

    if (!res.body) {
      return new Response("No stream body available from NestJS backend", {
        status: 500,
      });
    }

    return new Response(res.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
      },
    });
  } catch (err: any) {
    return new Response(err.message, { status: 500 });
  }
}

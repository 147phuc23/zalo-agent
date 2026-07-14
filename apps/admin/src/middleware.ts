import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isProduction = process.env.NODE_ENV === "production" || !!process.env.VERCEL;

function unauthorized(message: string) {
  return new NextResponse(message, {
    status: 401,
    headers: { "www-authenticate": 'Basic realm="admin", charset="UTF-8"' },
  });
}

export function middleware(request: NextRequest) {
  const publicPrefixes = ["/guest/", "/api/guest/"];
  if (publicPrefixes.some((p) => request.nextUrl.pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const expected = process.env.ADMIN_BASIC_AUTH;

  if (!expected) {
    // Never expose the app unauthenticated on a deployed environment.
    if (isProduction) {
      return new NextResponse("ADMIN_BASIC_AUTH is not configured", { status: 503 });
    }
    return NextResponse.next();
  }

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Basic ")) {
    return unauthorized("Authentication required");
  }

  let provided: string;
  try {
    provided = atob(header.slice("Basic ".length));
  } catch {
    return unauthorized("Invalid authorization header");
  }

  if (provided !== expected) {
    return unauthorized("Invalid credentials");
  }

  return NextResponse.next();
}

export const config = {
  // Protect everything (pages, /api, /uploads) except Next.js internals.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png).*)"],
};

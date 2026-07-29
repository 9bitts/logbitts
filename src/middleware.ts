import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const publicPaths = ["/login", "/api/auth", "/manifest.webmanifest", "/sw.js"];
  if (
    publicPaths.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/icon") ||
    pathname.startsWith("/_next")
  ) {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie && !pathname.startsWith("/api/")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!sessionCookie && pathname.startsWith("/api/") && !pathname.startsWith("/api/auth")) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

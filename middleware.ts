import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";

const PUBLIC_API = new Set([
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/logout",
  "/api/debug",
]);

const PUBLIC_PAGES = new Set([
  "/login",
  "/signup",
]);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Protect frontend pages - redirect to login if not authenticated
  if (!pathname.startsWith("/api") && !PUBLIC_PAGES.has(pathname)) {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    if (!token) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", req.url);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // Only guard API
  if (!pathname.startsWith("/api")) return NextResponse.next();

  // Allow auth endpoints
  if (PUBLIC_API.has(pathname)) return NextResponse.next();

  // Fast check (full validation happens inside route with DB)
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    // Redirect to login for browser requests
    if (req.headers.get("accept")?.includes("text/html")) {
      const loginUrl = new URL("/api/auth/login", req.url);
      loginUrl.searchParams.set("callbackUrl", req.url);
      return NextResponse.redirect(loginUrl);
    }
    // Return 401 for API requests
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|login|signup).*)",
  ],
};
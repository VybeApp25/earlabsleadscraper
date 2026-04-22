import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths and API routes through
  if (PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  // Check for token in cookies (set by login page)
  const token = request.cookies.get("ear_labs_token")?.value;

  // No token → redirect to login
  // Note: localStorage isn't accessible in middleware, so we use a cookie
  // The login page sets both localStorage AND a cookie on success
  if (!token && !pathname.startsWith("/_next") && !pathname.startsWith("/favicon")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

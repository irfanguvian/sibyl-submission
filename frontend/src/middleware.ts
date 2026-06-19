import { type NextRequest, NextResponse } from "next/server";

// Cookie names set by the BFF (`lib/auth-server.ts`).
const ACCESS_COOKIE = "tuition_access";
const REFRESH_COOKIE = "tuition_refresh";

/**
 * Edge auth gate. Redirects logged-out users away from protected pages to
 * /login *before* any data hook runs — this is what stops the 401 storm the app
 * used to throw when it booted straight into the dashboard. It only checks for
 * cookie presence (it cannot validate a token at the edge); expiry is handled by
 * the proxy's silent refresh and the client-side AuthGate.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has(ACCESS_COOKIE) || req.cookies.has(REFRESH_COOKIE);

  const isLoginRoute = pathname === "/login" || pathname.startsWith("/login/");

  if (isLoginRoute) {
    if (hasSession) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except API (BFF handles its own auth), Next internals,
  // and static assets.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt).*)"],
};

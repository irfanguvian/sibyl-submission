import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

/**
 * Server-only auth helpers for the BFF (`/api/auth/*`) route handlers.
 *
 * Tokens are kept in httpOnly cookies on the FRONTEND domain only — the browser
 * never sees them in JS and the backend never sets cookies. The BFF reads the
 * access cookie, forwards it as a `Authorization: Bearer` header to the backend,
 * and transparently rotates via the refresh cookie on a 401.
 */

export const ACCESS_COOKIE = "tuition_access";
export const REFRESH_COOKIE = "tuition_refresh";

/** Backend base URL as seen from the Next server (not the browser). */
export const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

export type BackendTokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

const isProd = process.env.NODE_ENV === "production";

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/** Write the token pair to httpOnly cookies on the given response. */
export function setTokenCookies(res: NextResponse, pair: BackendTokenPair): void {
  res.cookies.set(ACCESS_COOKIE, pair.accessToken, cookieOptions(pair.expiresIn));
  // Refresh cookie outlives the access token; 7 days matches the backend default.
  res.cookies.set(REFRESH_COOKIE, pair.refreshToken, cookieOptions(60 * 60 * 24 * 7));
}

/** Clear both auth cookies on the given response. */
export function clearTokenCookies(res: NextResponse): void {
  res.cookies.set(ACCESS_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
}

export async function getAccessToken(): Promise<string | undefined> {
  return (await cookies()).get(ACCESS_COOKIE)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  return (await cookies()).get(REFRESH_COOKIE)?.value;
}

/** Call the backend, returning the raw Response. */
export function backendFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
}

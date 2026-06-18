import {
  type BackendTokenPair,
  backendFetch,
  clearTokenCookies,
  getRefreshToken,
  setTokenCookies,
} from "@/lib/auth-server";
import { NextResponse } from "next/server";

export async function POST(): Promise<NextResponse> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    const res = NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    clearTokenCookies(res);
    return res;
  }

  const rr = await backendFetch("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });

  if (!rr.ok) {
    const res = NextResponse.json({ message: "Refresh failed" }, { status: 401 });
    clearTokenCookies(res);
    return res;
  }

  const pair = (await rr.json()) as BackendTokenPair;
  const response = NextResponse.json({ ok: true });
  setTokenCookies(response, pair);
  return response;
}

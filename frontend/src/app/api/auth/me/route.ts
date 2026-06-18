import {
  type BackendTokenPair,
  backendFetch,
  clearTokenCookies,
  getAccessToken,
  getRefreshToken,
  setTokenCookies,
} from "@/lib/auth-server";
import { NextResponse } from "next/server";

function unauthorized(): NextResponse {
  const res = NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  clearTokenCookies(res);
  return res;
}

/**
 * Returns the current user. On a 401 from the backend, transparently rotates the
 * refresh token once and retries before giving up — the "silent refresh".
 */
export async function GET(): Promise<NextResponse> {
  const accessToken = await getAccessToken();

  if (accessToken) {
    const res = await backendFetch("/auth/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      return NextResponse.json(await res.json());
    }
    if (res.status !== 401) {
      return NextResponse.json({ message: "Upstream error" }, { status: 502 });
    }
  }

  // Access token missing or rejected — attempt a single silent refresh.
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    return unauthorized();
  }

  const rr = await backendFetch("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
  if (!rr.ok) {
    return unauthorized();
  }

  const pair = (await rr.json()) as BackendTokenPair;
  const retry = await backendFetch("/auth/me", {
    headers: { Authorization: `Bearer ${pair.accessToken}` },
  });
  if (!retry.ok) {
    return unauthorized();
  }

  const response = NextResponse.json(await retry.json());
  setTokenCookies(response, pair);
  return response;
}

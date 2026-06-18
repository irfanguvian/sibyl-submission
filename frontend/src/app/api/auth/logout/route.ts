import { backendFetch, clearTokenCookies, getAccessToken } from "@/lib/auth-server";
import { NextResponse } from "next/server";

export async function POST(): Promise<NextResponse> {
  const accessToken = await getAccessToken();
  if (accessToken) {
    // Best-effort backend revocation; we clear local cookies regardless.
    await backendFetch("/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => undefined);
  }

  const response = NextResponse.json({ ok: true });
  clearTokenCookies(response);
  return response;
}

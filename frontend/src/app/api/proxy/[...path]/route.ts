import {
  ACCESS_COOKIE,
  BACKEND_URL,
  type BackendTokenPair,
  REFRESH_COOKIE,
  clearTokenCookies,
  setTokenCookies,
} from "@/lib/auth-server";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Authenticated reverse proxy: forwards `/api/proxy/<path>` to the backend with
 * the access cookie as a bearer token. On a 401 it performs one silent refresh
 * (rotating the cookies) and retries. JSON bodies are forwarded; multipart bodies
 * are streamed through unchanged.
 */

async function callBackend(
  req: NextRequest,
  path: string,
  accessToken: string | undefined,
): Promise<Response> {
  const search = req.nextUrl.search;
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const contentType = req.headers.get("content-type");
  const method = req.method;
  let body: BodyInit | undefined;

  if (method !== "GET" && method !== "HEAD") {
    if (contentType?.includes("application/json")) {
      headers["Content-Type"] = contentType;
      body = await req.text();
    } else if (contentType) {
      // multipart / binary — pass the raw bytes + original content-type through
      headers["Content-Type"] = contentType;
      body = Buffer.from(await req.arrayBuffer());
    }
  }

  return fetch(`${BACKEND_URL}/${path}${search}`, {
    method,
    headers,
    body,
    redirect: "manual",
    cache: "no-store",
  });
}

async function relay(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const joined = path.join("/");

  const cookieStore = req.cookies;
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

  let upstream = await callBackend(req, joined, accessToken);
  let rotated: BackendTokenPair | null = null;

  if (upstream.status === 401 && refreshToken) {
    const rr = await fetch(`${BACKEND_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
    if (rr.ok) {
      rotated = (await rr.json()) as BackendTokenPair;
      upstream = await callBackend(req, joined, rotated.accessToken);
    }
  }

  // Pass redirects (e.g. document download → presigned URL) straight through.
  const location = upstream.headers.get("location");
  if (location && upstream.status >= 300 && upstream.status < 400) {
    const redirectRes = NextResponse.redirect(location, upstream.status as 302);
    if (rotated) {
      setTokenCookies(redirectRes, rotated);
    }
    return redirectRes;
  }

  const text = await upstream.text();
  const res = new NextResponse(text, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });

  if (rotated) {
    setTokenCookies(res, rotated);
  } else if (upstream.status === 401) {
    clearTokenCookies(res);
  }
  return res;
}

export const GET = relay;
export const POST = relay;
export const PATCH = relay;
export const PUT = relay;
export const DELETE = relay;

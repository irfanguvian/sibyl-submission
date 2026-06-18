import { type BackendTokenPair, backendFetch, setTokenCookies } from "@/lib/auth-server";
import { NextResponse } from "next/server";

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  if (!body?.email || !body?.password) {
    return NextResponse.json({ message: "email and password are required" }, { status: 400 });
  }

  const res = await backendFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: body.email, password: body.password }),
  });

  if (!res.ok) {
    return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
  }

  const pair = (await res.json()) as BackendTokenPair;
  const response = NextResponse.json({ ok: true });
  setTokenCookies(response, pair);
  return response;
}

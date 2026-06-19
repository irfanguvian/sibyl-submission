import { backendFetch } from "@/lib/auth-server";
import { NextResponse } from "next/server";

/**
 * Registration is a pass-through: unlike login it sets no cookies. The backend
 * creates the account (201) and the client then redirects to /login to sign in.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  if (!body?.email || !body?.password || !body?.role) {
    return NextResponse.json({ message: "email, password and role are required" }, { status: 400 });
  }

  const res = await backendFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: body.email,
      password: body.password,
      role: body.role,
      ...(body.displayName ? { displayName: body.displayName } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    let message = "Could not create the account";
    try {
      const parsed = JSON.parse(text) as { message?: string | string[] };
      if (parsed?.message) {
        message = Array.isArray(parsed.message) ? parsed.message.join(", ") : parsed.message;
      }
    } catch {
      // non-JSON error body
    }
    return NextResponse.json({ message }, { status: res.status });
  }

  return NextResponse.json(await res.json(), { status: 201 });
}

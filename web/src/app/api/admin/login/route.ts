import { NextResponse } from "next/server";
import { createToken, publicUser, type AuthenticatedUser, verifyPassword } from "@/lib/auth";
import { assertDatabaseConfigured, row } from "@/lib/database";
import type { RowDataPacket } from "@/lib/database";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let stage = "database initialization";
  try {
    await assertDatabaseConfigured();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ status: false, message: "The given data was invalid.", data: {} }, { status: 422 });
    }

    const input = body as Record<string, unknown> | null;
    const email = typeof input?.email === "string" ? input.email.trim().toLowerCase() : "";
    const password = typeof input?.password === "string" ? input.password : "";
    if (!email || !password) {
      return NextResponse.json({ status: false, message: "Email and password are required.", data: {} }, { status: 422 });
    }

    stage = "user lookup";
    const user = await row<AuthenticatedUser & RowDataPacket>("SELECT * FROM users WHERE email = ? AND role IN ('admin','manager','employee') AND status = 'active' LIMIT 1", [email]);
    if (!user) {
      return NextResponse.json({ status: false, message: "Invalid email or password.", data: {} }, { status: 401 });
    }

    stage = "password verification";
    if (!(await verifyPassword(password, user.password))) {
      return NextResponse.json({ status: false, message: "Invalid email or password.", data: {} }, { status: 401 });
    }

    stage = "token creation";
    const token = await createToken(user.id, "admin-web");
    return NextResponse.json({
      status: true,
      message: "Login successful",
      data: { user: publicUser(user), token, token_type: "Bearer" },
    });
  } catch (error) {
    const metadata = error && typeof error === "object"
      ? {
          name: "name" in error ? String(error.name) : "UnknownError",
          code: "code" in error ? String(error.code) : undefined,
        }
      : { name: "UnknownError", code: undefined };
    console.error("[admin/login] request failed", { stage, ...metadata });
    return NextResponse.json({ status: false, message: "تعذر تسجيل الدخول بسبب خطأ بالخادم.", data: {} }, { status: 500 });
  }
}

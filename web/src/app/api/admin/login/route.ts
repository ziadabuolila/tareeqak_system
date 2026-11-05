import { NextResponse } from "next/server";
import { createToken, publicUser, type AuthenticatedUser, verifyPassword } from "@/lib/auth";
import { initializeDatabase, row } from "@/lib/database";
import type { RowDataPacket } from "@/lib/database";

export const runtime = "nodejs";

export async function POST(request: Request) {
  await initializeDatabase();

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

  const user = await row<AuthenticatedUser & RowDataPacket>("SELECT * FROM users WHERE email = ? AND role IN ('admin','manager','employee') AND status = 'active' LIMIT 1", [email]);
  if (!user || !(await verifyPassword(password, user.password))) {
    return NextResponse.json({ status: false, message: "Invalid email or password.", data: {} }, { status: 401 });
  }

  const token = await createToken(user.id, "admin-web");
  return NextResponse.json({
    status: true,
    message: "Login successful",
    data: { user: publicUser(user), token, token_type: "Bearer" },
  });
}

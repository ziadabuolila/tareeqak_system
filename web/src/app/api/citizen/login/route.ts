import { NextResponse } from "next/server";
import { createToken, publicUser, type AuthenticatedUser, verifyPassword } from "@/lib/auth";
import { assertDatabaseConfigured, row } from "@/lib/database";
import type { RowDataPacket } from "@/lib/database";

export const runtime = "nodejs";

function failure(message: string, status: number, errors?: Record<string, string[]>) {
  return NextResponse.json({ status: false, message, data: {}, ...(errors ? { errors } : {}) }, { status });
}

export async function POST(request: Request) {
  await assertDatabaseConfigured();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failure("The given data was invalid.", 422, { phone: ["A valid JSON body is required."] });
  }

  const input = body as Record<string, unknown> | null;
  const phone = typeof input?.phone === "string" ? input.phone.trim() : "";
  const password = typeof input?.password === "string" ? input.password : "";
  const errors: Record<string, string[]> = {};

  if (!phone) errors.phone = ["The phone field is required."];
  else if (!/^01[0125]\d{8}$/.test(phone)) errors.phone = ["The phone format is invalid."];
  if (!password) errors.password = ["The password field is required."];
  else if (password.length < 6) errors.password = ["The password field must be at least 6 characters."];
  if (Object.keys(errors).length) return failure("The given data was invalid.", 422, errors);

  const user = await row<AuthenticatedUser & RowDataPacket>("SELECT * FROM users WHERE phone = ? AND role = 'citizen' AND status = 'active' LIMIT 1", [phone]);
  if (!user || !(await verifyPassword(password, user.password))) {
    return failure("Invalid phone number or password.", 401);
  }

  const token = await createToken(user.id);
  return NextResponse.json({
    status: true,
    message: "Login successful",
    data: { user: publicUser(user), token, token_type: "Bearer" },
  });
}



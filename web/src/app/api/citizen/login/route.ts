import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createToken, publicUser, type AuthenticatedUser, verifyPassword } from "@/lib/auth";
import { assertDatabaseConfigured, execute, row } from "@/lib/database";
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
  const requiresApproval = input?.requires_approval === true;
  const deviceLabel = typeof input?.device_label === "string" ? input.device_label.trim().slice(0, 120) : "جهاز جديد";
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

  if (requiresApproval) {
    const activeDevices = await row<{ total: number } & RowDataPacket>("SELECT COUNT(*) AS total FROM personal_access_tokens WHERE tokenable_id=? AND name <> 'admin-web' AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)", [user.id]);
    if (Number(activeDevices?.total ?? 0) > 0) {
      const requestId = randomUUID();
      await execute("UPDATE citizen_login_requests SET status='expired' WHERE user_id=? AND status='pending'", [user.id]);
      await execute(`INSERT INTO citizen_login_requests(request_id,user_id,device_label,status,created_at,expires_at)
        VALUES(?,?,?,'pending',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP + INTERVAL '5 minutes')`, [requestId, user.id, deviceLabel || "جهاز جديد"]);
      return NextResponse.json({ status: false, message: "يرجى انتظار موافقة صاحب الحساب.", data: { request_id: requestId, state: "pending", check_after_seconds: 3, expires_in_seconds: 300 } }, { status: 202 });
    }
  }

  const token = await createToken(user.id);
  return NextResponse.json({
    status: true,
    message: "Login successful",
    data: { user: publicUser(user), token, token_type: "Bearer" },
  });
}



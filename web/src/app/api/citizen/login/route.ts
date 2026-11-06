import { NextResponse } from "next/server";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { publicUser, type AuthenticatedUser, verifyPassword } from "@/lib/auth";
import { assertDatabaseConfigured, database, row } from "@/lib/database";
import type { RowDataPacket } from "@/lib/database";

export const runtime = "nodejs";
const deviceIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const suppliedDeviceId = typeof input?.device_id === "string" ? input.device_id.trim() : request.headers.get("x-device-id")?.trim() ?? "";
  const deviceId = suppliedDeviceId && deviceIdPattern.test(suppliedDeviceId) ? suppliedDeviceId.toLowerCase() : "";
  const errors: Record<string, string[]> = {};

  if (!phone) errors.phone = ["The phone field is required."];
  else if (!/^01[0125]\d{8}$/.test(phone)) errors.phone = ["The phone format is invalid."];
  if (!password) errors.password = ["The password field is required."];
  else if (password.length < 6) errors.password = ["The password field must be at least 6 characters."];
  if (suppliedDeviceId && !deviceId) errors.device_id = ["The device identifier is invalid."];
  if (Object.keys(errors).length) return failure("The given data was invalid.", 422, errors);

  const user = await row<AuthenticatedUser & RowDataPacket>("SELECT id,name,email,phone,password,status,created_at,updated_at,'citizen' AS role FROM citizens WHERE phone = ? AND status = 'active' LIMIT 1", [phone]);
  if (!user || !(await verifyPassword(password, user.password))) {
    return failure("Invalid phone number or password.", 401);
  }

  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();
    const locked = await connection.execute<{ primary_device_id: string | null } & RowDataPacket>(
      "SELECT primary_device_id FROM citizens WHERE id=? AND status='active' FOR UPDATE", [user.id]);
    if (!locked.rows[0]) {
      await connection.rollback();
      return failure("Invalid phone number or password.", 401);
    }
    const primaryDeviceId = locked.rows[0].primary_device_id?.toLowerCase() ?? "";
    const active = await connection.execute<{ total: number; legacy: number } & RowDataPacket>(`SELECT COUNT(*) AS total,
      COUNT(*) FILTER (WHERE name='mobile-app') AS legacy FROM personal_access_tokens
      WHERE tokenable_id=? AND tokenable_type='App\\Models\\Citizen' AND name <> 'admin-web'
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`, [user.id]);
    const activeDeviceCount = Number(active.rows[0]?.total ?? 0);
    const sameDevice = Boolean(deviceId && primaryDeviceId === deviceId);
    // Claim the only untagged legacy session once after upgrading from old app builds.
    const claimingLegacyDevice = Boolean(deviceId && !primaryDeviceId && activeDeviceCount === 1 && Number(active.rows[0]?.legacy ?? 0) === 1);

    if (requiresApproval && activeDeviceCount > 0 && !sameDevice && !claimingLegacyDevice) {
      const requestId = randomUUID();
      await connection.execute("UPDATE citizen_login_requests SET status='expired' WHERE citizen_id=? AND status='pending'", [user.id]);
      await connection.execute(`INSERT INTO citizen_login_requests(request_id,citizen_id,device_label,device_id,status,created_at,expires_at)
        VALUES(?,?,?,?, 'pending',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP + INTERVAL '5 minutes')`,
      [requestId, user.id, deviceLabel || "جهاز جديد", deviceId]);
      await connection.commit();
      return NextResponse.json({ status: false, message: "يرجى انتظار موافقة صاحب الحساب.", data: { request_id: requestId, state: "pending", check_after_seconds: 3, expires_in_seconds: 300 } }, { status: 202 });
    }

    if (sameDevice || claimingLegacyDevice) {
      await connection.execute("DELETE FROM personal_access_tokens WHERE tokenable_id=? AND tokenable_type='App\\Models\\Citizen' AND name <> 'admin-web'", [user.id]);
    }
    if (deviceId && (sameDevice || claimingLegacyDevice || activeDeviceCount === 0 || !primaryDeviceId)) {
      await connection.execute("UPDATE citizens SET primary_device_id=? WHERE id=?", [deviceId, user.id]);
    }

    const secret = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(secret).digest("hex");
    const tokenName = deviceId ? `mobile-app:${deviceId}` : "mobile-app";
    const created = await connection.execute<{ id: number } & RowDataPacket>(`INSERT INTO personal_access_tokens(tokenable_type,tokenable_id,name,token,abilities,created_at,updated_at)
      VALUES('App\\Models\\Citizen',?,?,?,'["*"]',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING id`, [user.id, tokenName, tokenHash]);
    const token = `${created.rows[0].id}|${secret}`;
    await connection.commit();
    return NextResponse.json({ status: true, message: "Login successful", data: { user: publicUser(user), token, token_type: "Bearer" } });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}



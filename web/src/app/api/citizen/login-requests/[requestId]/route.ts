import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getRequestToken, getUserForToken } from "@/lib/auth";
import { assertDatabaseConfigured, database } from "@/lib/database";
import type { RowDataPacket } from "@/lib/database";
import { citizenDeviceIdPattern, isCitizenOwnerDevice } from "@/lib/citizen-devices";

export const runtime = "nodejs";
type Params = { params: Promise<{ requestId: string }> };

export async function PATCH(request: Request, context: Params) {
  await assertDatabaseConfigured();
  const actor = await getUserForToken(await getRequestToken(request));
  if (!actor || actor.role !== "citizen") return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  if (!(await isCitizenOwnerDevice(actor.id, request.headers.get("x-device-id")?.trim().toLowerCase() ?? ""))) {
    return NextResponse.json({ message: "موافقة طلبات الدخول متاحة من الهاتف الأساسي لصاحب الحساب فقط." }, { status: 403 });
  }
  let body: { action?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ message: "بيانات الموافقة غير صالحة." }, { status: 422 }); }
  const action = body.action === "approve" ? "approved" : body.action === "reject" ? "rejected" : "";
  if (!action) return NextResponse.json({ message: "اختر السماح أو الرفض." }, { status: 422 });

  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();
    const found = await connection.execute<{ citizen_id: number; status: string; expires_at: string; device_id: string | null } & RowDataPacket>(
      "SELECT citizen_id,status,expires_at,device_id FROM citizen_login_requests WHERE request_id=? FOR UPDATE", [(await context.params).requestId]);
    const loginRequest = found.rows[0];
    // Normalize database ID values before comparing them.
    if (!loginRequest || Number(loginRequest.citizen_id) !== Number(actor.id)) {
      await connection.rollback();
      return NextResponse.json({ message: "طلب تسجيل الدخول غير موجود." }, { status: 404 });
    }
    if (loginRequest.status !== "pending" || new Date(loginRequest.expires_at).valueOf() <= Date.now()) {
      if (loginRequest.status === "pending") await connection.execute("UPDATE citizen_login_requests SET status='expired' WHERE request_id=?", [(await context.params).requestId]);
      await connection.commit();
      return NextResponse.json({ message: "انتهت صلاحية طلب تسجيل الدخول." }, { status: 410 });
    }
    if (action === "approved" && loginRequest.device_id) {
      const targetDevice = await connection.execute<{ status: string } & RowDataPacket>(
        "SELECT status FROM citizen_devices WHERE citizen_id=? AND device_id=? FOR UPDATE", [actor.id, loginRequest.device_id]);
      if (targetDevice.rows[0]?.status === "blocked") {
        await connection.rollback();
        return NextResponse.json({ message: "هذا الهاتف محظور بالفعل." }, { status: 403 });
      }
    }
    await connection.execute("UPDATE citizen_login_requests SET status=? WHERE request_id=?", [action, (await context.params).requestId]);
    await connection.commit();
    return NextResponse.json({ status: true, data: { state: action }, message: action === "approved" ? "تم السماح بتسجيل الدخول على الجهاز الجديد." : "تم رفض طلب تسجيل الدخول." });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

export async function GET(_request: Request, context: Params) {
  await assertDatabaseConfigured();
  const requestId = (await context.params).requestId;
  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();
    const found = await connection.execute<{ citizen_id: number; status: string; expires_at: string; device_id: string | null; device_label: string } & RowDataPacket>(
      "SELECT citizen_id,status,expires_at,device_id,device_label FROM citizen_login_requests WHERE request_id=? FOR UPDATE", [requestId]);
    const loginRequest = found.rows[0];
    if (!loginRequest) { await connection.rollback(); return NextResponse.json({ message: "طلب تسجيل الدخول غير موجود." }, { status: 404 }); }
    if (loginRequest.status === "pending" && new Date(loginRequest.expires_at).valueOf() <= Date.now()) {
      await connection.execute("UPDATE citizen_login_requests SET status='expired' WHERE request_id=?", [requestId]);
      await connection.commit();
      return NextResponse.json({ status: true, data: { state: "expired" } });
    }
    if (loginRequest.status !== "approved") {
      await connection.commit();
      const message = loginRequest.status === "pending" ? "يرجى انتظار موافقة صاحب الحساب." : loginRequest.status === "rejected" ? "تم رفض طلب الدخول من صاحب الحساب." : loginRequest.status === "expired" ? "انتهت صلاحية طلب تسجيل الدخول." : "تم استخدام طلب تسجيل الدخول.";
      return NextResponse.json({ status: true, message, data: { state: loginRequest.status } }, { headers: { "Cache-Control": "no-store" } });
    }

    const deviceId = loginRequest.device_id && citizenDeviceIdPattern.test(loginRequest.device_id) ? loginRequest.device_id.toLowerCase() : "";
    if (deviceId) {
      const targetDevice = await connection.execute<{ status: string } & RowDataPacket>(
        "SELECT status FROM citizen_devices WHERE citizen_id=? AND device_id=? FOR UPDATE", [loginRequest.citizen_id, deviceId]);
      if (targetDevice.rows[0]?.status === "blocked") {
        await connection.execute("UPDATE citizen_login_requests SET status='rejected' WHERE request_id=?", [requestId]);
        await connection.commit();
        return NextResponse.json({ status: true, message: "هذا الهاتف محظور من صاحب الحساب.", data: { state: "rejected" } });
      }
    }

    const account = await connection.execute<{ id: number; name: string; phone: string; email: string | null; role: string; status: string; created_at: string; updated_at: string } & RowDataPacket>(
      "SELECT id,name,phone,email,'citizen' AS role,status,created_at,updated_at FROM citizens WHERE id=? AND status='active'", [loginRequest.citizen_id]);
    const user = account.rows[0];
    if (!user) {
      await connection.execute("UPDATE citizen_login_requests SET status='expired' WHERE request_id=?", [requestId]);
      await connection.commit();
      return NextResponse.json({ message: "الحساب غير متاح." }, { status: 403 });
    }
    const secret = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(secret).digest("hex");
    const tokenName = deviceId ? `mobile-app:${deviceId}` : "mobile-app";
    const created = await connection.execute<{ id: number } & RowDataPacket>(`INSERT INTO personal_access_tokens(tokenable_type,tokenable_id,name,token,abilities,created_at,updated_at)
      VALUES('App\\Models\\Citizen',?,?,?,'["*"]',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`, [user.id, tokenName, tokenHash]);
    const token = `${created.insertId}|${secret}`;
    if (deviceId) {
      await connection.execute(`INSERT INTO citizen_devices(citizen_id,device_id,device_label,status,first_seen_at,last_seen_at,created_at,updated_at)
        VALUES(?,?,?,'active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE device_label=IF(citizen_devices.status='active',VALUES(device_label),citizen_devices.device_label),
          last_seen_at=IF(citizen_devices.status='active',CURRENT_TIMESTAMP,citizen_devices.last_seen_at),updated_at=CURRENT_TIMESTAMP`,
      [user.id, deviceId, loginRequest.device_label || "هاتف محمول"]);
    }
    await connection.execute("UPDATE citizen_login_requests SET status='completed' WHERE request_id=?", [requestId]);
    await connection.commit();
    return NextResponse.json({ status: true, message: "Login successful", data: { state: "completed", user, token, token_type: "Bearer" } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

import { NextResponse } from "next/server";
import { getRequestToken, getUserForToken } from "@/lib/auth";
import { assertDatabaseConfigured, database } from "@/lib/database";
import type { RowDataPacket } from "@/lib/database";
import { citizenDeviceIdPattern, isCitizenOwnerDevice } from "@/lib/citizen-devices";

export const runtime = "nodejs";

type Params = { params: Promise<{ deviceId: string }> };

export async function PATCH(request: Request, context: Params) {
  await assertDatabaseConfigured();
  const actor = await getUserForToken(await getRequestToken(request));
  if (!actor || actor.role !== "citizen") return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const deviceId = decodeURIComponent((await context.params).deviceId).toLowerCase();
  if (!citizenDeviceIdPattern.test(deviceId)) return NextResponse.json({ message: "معرّف الهاتف غير صالح." }, { status: 422 });
  const ownerDeviceId = request.headers.get("x-device-id")?.trim().toLowerCase() ?? "";
  if (!(await isCitizenOwnerDevice(actor.id, ownerDeviceId))) return NextResponse.json({ message: "إدارة حظر الهواتف متاحة من الهاتف الأساسي لصاحب الحساب فقط." }, { status: 403 });

  let body: { action?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ message: "بيانات الإجراء غير صالحة." }, { status: 422 }); }
  if (body.action !== "block" && body.action !== "unblock") return NextResponse.json({ message: "اختر الحظر أو إلغاء الحظر." }, { status: 422 });
  if (body.action === "block" && deviceId === ownerDeviceId) return NextResponse.json({ message: "ما ينفعش تحظر الهاتف الأساسي المفتوح منه حسابك." }, { status: 422 });
  const status = body.action === "block" ? "blocked" : "active";

  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();
    const changed = await connection.execute<{ device_id: string; status: string } & RowDataPacket>(
      `UPDATE citizen_devices SET status=?,blocked_at=${body.action === "block" ? "CURRENT_TIMESTAMP" : "NULL"},
        updated_at=CURRENT_TIMESTAMP WHERE citizen_id=? AND device_id=? RETURNING device_id,status`,
      [status, actor.id, deviceId]);
    if (!changed.rows[0]) {
      await connection.rollback();
      return NextResponse.json({ message: "الهاتف مش مسجل على الحساب." }, { status: 404 });
    }

    if (body.action === "block") {
      await connection.execute("DELETE FROM personal_access_tokens WHERE tokenable_id=? AND tokenable_type='App\\Models\\Citizen' AND name=?", [actor.id, `mobile-app:${deviceId}`]);
      await connection.execute("UPDATE citizen_login_requests SET status='rejected' WHERE citizen_id=? AND device_id=? AND status IN ('pending','approved')", [actor.id, deviceId]);
    }

    await connection.commit();
    return NextResponse.json({ status: true, message: body.action === "block" ? "تم حظر الهاتف وإيقاف دخوله للحساب." : "تم إلغاء حظر الهاتف.", data: { device_id: deviceId, status } });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getRequestToken, getUserForToken } from "@/lib/auth";
import { assertDatabaseConfigured, database } from "@/lib/database";
import type { RowDataPacket } from "@/lib/database";

export const runtime = "nodejs";
type Params = { params: Promise<{ requestId: string }> };

export async function PATCH(request: Request, context: Params) {
  await assertDatabaseConfigured();
  const actor = await getUserForToken(await getRequestToken(request));
  if (!actor || actor.role !== "citizen") return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  let body: { action?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ message: "بيانات الموافقة غير صالحة." }, { status: 422 }); }
  const action = body.action === "approve" ? "approved" : body.action === "reject" ? "rejected" : "";
  if (!action) return NextResponse.json({ message: "اختر السماح أو الرفض." }, { status: 422 });

  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();
    const found = await connection.execute<{ citizen_id: number; status: string; expires_at: string } & RowDataPacket>(
      "SELECT citizen_id,status,expires_at FROM citizen_login_requests WHERE request_id=? FOR UPDATE", [(await context.params).requestId]);
    const loginRequest = found.rows[0];
    if (!loginRequest || Number(loginRequest.citizen_id) !== actor.id) {
      await connection.rollback();
      return NextResponse.json({ message: "طلب تسجيل الدخول غير موجود." }, { status: 404 });
    }
    if (loginRequest.status !== "pending" || new Date(loginRequest.expires_at).valueOf() <= Date.now()) {
      if (loginRequest.status === "pending") await connection.execute("UPDATE citizen_login_requests SET status='expired' WHERE request_id=?", [(await context.params).requestId]);
      await connection.commit();
      return NextResponse.json({ message: "انتهت صلاحية طلب تسجيل الدخول." }, { status: 410 });
    }
    if (action === "approved") {
      await connection.execute("DELETE FROM personal_access_tokens WHERE tokenable_id=? AND tokenable_type='App\\Models\\Citizen' AND name <> 'admin-web'", [actor.id]);
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
    const found = await connection.execute<{ citizen_id: number; status: string; expires_at: string } & RowDataPacket>(
      "SELECT citizen_id,status,expires_at FROM citizen_login_requests WHERE request_id=? FOR UPDATE", [requestId]);
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
    const created = await connection.execute<{ id: number } & RowDataPacket>(`INSERT INTO personal_access_tokens(tokenable_type,tokenable_id,name,token,abilities,created_at,updated_at)
      VALUES('App\\Models\\Citizen',?,'mobile-app',?,'["*"]',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING id`, [user.id, tokenHash]);
    const token = `${created.rows[0].id}|${secret}`;
    await connection.execute("UPDATE citizen_login_requests SET status='completed' WHERE request_id=?", [requestId]);
    await connection.commit();
    return NextResponse.json({ status: true, message: "Login successful", data: { state: "completed", user, token, token_type: "Bearer" } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

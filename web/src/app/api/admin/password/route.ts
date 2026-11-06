import { NextResponse } from "next/server";
import { hashPassword, getStaffForRequest, verifyPassword } from "@/lib/auth";
import { execute, assertDatabaseConfigured } from "@/lib/database";
export const runtime = "nodejs";
export async function PATCH(request: Request) {
  await assertDatabaseConfigured();
  const user = await getStaffForRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  let body: { currentPassword?: unknown; newPassword?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ message: "بيانات كلمة المرور غير صالحة." }, { status: 422 }); }
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  if (newPassword.length < 8) return NextResponse.json({ message: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل." }, { status: 422 });
  if (!(await verifyPassword(currentPassword, user.password))) return NextResponse.json({ message: "كلمة المرور الحالية غير صحيحة." }, { status: 422 });
  await execute("UPDATE users SET password=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", [await hashPassword(newPassword),user.id]);
  return NextResponse.json({ status: true, message: "تم تحديث كلمة المرور." });
}

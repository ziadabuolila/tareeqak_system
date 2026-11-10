import { NextResponse } from "next/server";
import { getStaffForRequest, publicUser } from "@/lib/auth";
import { execute, assertDatabaseConfigured, isDuplicateError, row } from "@/lib/database";
import type { RowDataPacket } from "@/lib/database";
export const runtime = "nodejs";
export async function GET(request: Request) {
  await assertDatabaseConfigured();
  const user = await getStaffForRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  return NextResponse.json({ status: true, data: { user: publicUser(user) } });
}
export async function PATCH(request: Request) {
  await assertDatabaseConfigured();
  const user = await getStaffForRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  let body: { name?: unknown; email?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ message: "بيانات الحساب غير صالحة." }, { status: 422 }); }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ message: "أدخل اسمًا وبريدًا إلكترونيًا صحيحًا." }, { status: 422 });
  try {
    await execute("UPDATE users SET name=?,email=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", [name,email,user.id]);
    if (email !== (user.email ?? "").toLowerCase()) await execute("DELETE FROM personal_access_tokens WHERE tokenable_id=? AND tokenable_type='App\\Models\\User'", [user.id]);
    const updated = await row<typeof user & RowDataPacket>("SELECT * FROM users WHERE id=?", [user.id]);
    return NextResponse.json({ status: true, data: { user: publicUser(updated) } });
  } catch (error) {
    if (isDuplicateError(error)) return NextResponse.json({ message: "البريد الإلكتروني مستخدم بالفعل." }, { status: 409 });
    return NextResponse.json({ message: "تعذر حفظ بيانات الحساب." }, { status: 500 });
  }
}

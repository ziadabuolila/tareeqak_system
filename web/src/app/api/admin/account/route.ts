import { NextResponse } from "next/server";
import { getAdminForRequest, publicUser } from "@/lib/auth";
import { execute, initializeDatabase, row } from "@/lib/database";
import type { RowDataPacket } from "mysql2/promise";
export const runtime = "nodejs";
export async function GET(request: Request) {
  await initializeDatabase();
  const user = await getAdminForRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  return NextResponse.json({ status: true, data: { user: publicUser(user) } });
}
export async function PATCH(request: Request) {
  await initializeDatabase();
  const user = await getAdminForRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  let body: { name?: unknown; email?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ message: "بيانات الحساب غير صالحة." }, { status: 422 }); }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ message: "أدخل اسمًا وبريدًا إلكترونيًا صحيحًا." }, { status: 422 });
  try {
    await execute("UPDATE users SET name=?,email=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", [name,email,user.id]);
    const updated = await row<typeof user & RowDataPacket>("SELECT * FROM users WHERE id=?", [user.id]);
    return NextResponse.json({ status: true, data: { user: publicUser(updated) } });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ER_DUP_ENTRY") return NextResponse.json({ message: "البريد الإلكتروني مستخدم بالفعل." }, { status: 409 });
    return NextResponse.json({ message: "تعذر حفظ بيانات الحساب." }, { status: 500 });
  }
}

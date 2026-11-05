import { NextResponse } from "next/server";
import { getAdminForRequest } from "@/lib/auth";
import { execute, initializeDatabase } from "@/lib/database";
export const runtime = "nodejs";
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  await initializeDatabase();
  if (!(await getAdminForRequest(request))) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const result = await execute("UPDATE notifications SET is_read=TRUE WHERE id=?", [Number((await context.params).id)]);
  if (!result.affectedRows) return NextResponse.json({ message: "الإشعار غير موجود." }, { status: 404 });
  return NextResponse.json({ status: true });
}
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  await initializeDatabase();
  if (!(await getAdminForRequest(request))) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  await execute("DELETE FROM notifications WHERE id=?", [Number((await context.params).id)]);
  return NextResponse.json({ status: true });
}

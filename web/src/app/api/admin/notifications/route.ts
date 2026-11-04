import { NextResponse } from "next/server";
import { getAdminForRequest } from "@/lib/auth";
import { execute, initializeDatabase, rows } from "@/lib/database";
import type { RowDataPacket } from "mysql2/promise";
export const runtime = "nodejs";
export async function GET(request: Request) {
  await initializeDatabase();
  if (!(await getAdminForRequest(request))) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const notifications = await rows<RowDataPacket>("SELECT id,title,body,kind,is_read AS `read`,created_at FROM notifications ORDER BY created_at DESC,id DESC");
  return NextResponse.json({ status: true, data: { notifications } });
}
export async function PATCH(request: Request) {
  await initializeDatabase();
  if (!(await getAdminForRequest(request))) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  await execute("UPDATE notifications SET is_read=1 WHERE is_read=0");
  return NextResponse.json({ status: true });
}

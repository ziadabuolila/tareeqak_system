import { NextResponse } from "next/server";
import { getManagerForRequest, getStaffForRequest } from "@/lib/auth";
import { execute, assertDatabaseConfigured, rows } from "@/lib/database";
import type { RowDataPacket } from "@/lib/database";
export const runtime = "nodejs";
export async function GET(request: Request) {
  await assertDatabaseConfigured();
  if (!(await getStaffForRequest(request))) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const notifications = await rows<RowDataPacket>("SELECT id,title,body,kind,is_read AS read,created_at FROM notifications ORDER BY created_at DESC,id DESC");
  return NextResponse.json({ status: true, data: { notifications } });
}
export async function PATCH(request: Request) {
  await assertDatabaseConfigured();
  if (!(await getManagerForRequest(request))) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  await execute("UPDATE notifications SET is_read=TRUE WHERE is_read=FALSE");
  return NextResponse.json({ status: true });
}

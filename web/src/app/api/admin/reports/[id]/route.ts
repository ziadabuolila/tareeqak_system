import { NextResponse } from "next/server";
import { getManagerForRequest, getStaffForRequest } from "@/lib/auth";
import { execute, assertDatabaseConfigured, row } from "@/lib/database";
import type { RowDataPacket } from "@/lib/database";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  await assertDatabaseConfigured();
  if (!(await getStaffForRequest(request))) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const id = Number((await context.params).id);
  if (!Number.isSafeInteger(id)) return NextResponse.json({ message: "معرّف البلاغ غير صالح." }, { status: 422 });
  const report = await row<Record<string, unknown> & RowDataPacket>(`SELECT reports.*,citizens.name AS user_name,citizens.phone AS user_phone FROM reports
    LEFT JOIN citizens ON citizens.id=reports.citizen_id WHERE reports.id=?`, [id]);
  if (!report) return NextResponse.json({ message: "البلاغ غير موجود." }, { status: 404 });
  const image = report.image_data as Uint8Array | null;
  delete report.image_data;
  return NextResponse.json({ status: true, data: { report: { ...report, image_base64: image ? Buffer.from(image).toString("base64") : null } } });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  await assertDatabaseConfigured();
  if (!(await getManagerForRequest(request))) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const { id: rawId } = await context.params;
  const id = Number(rawId);
  let body: { status?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ message: "بيانات غير صالحة." }, { status: 422 }); }
  const status = body.status;
  if (!Number.isSafeInteger(id) || !["pending", "in_progress", "resolved", "rejected"].includes(String(status))) return NextResponse.json({ message: "حالة البلاغ غير صالحة." }, { status: 422 });
  const result = await execute("UPDATE reports SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [String(status), id]);
  if (!result.affectedRows) return NextResponse.json({ message: "البلاغ غير موجود." }, { status: 404 });
  const report = await row<{ reference: string; status: string } & RowDataPacket>("SELECT reference,status FROM reports WHERE id = ?", [id]);
  if (!report) return NextResponse.json({ message: "البلاغ غير موجود." }, { status: 404 });
  await execute("INSERT INTO notifications(title,body,kind) VALUES(?,?,?)", ["تم تحديث حالة بلاغ", `تم تحديث حالة البلاغ ${report.reference}.`, status === "resolved" ? "success" : "info"]);
  return NextResponse.json({ status: true, data: { report } });
}

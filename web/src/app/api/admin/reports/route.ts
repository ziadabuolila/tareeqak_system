import { NextResponse } from "next/server";
import { getStaffForRequest } from "@/lib/auth";
import { assertDatabaseConfigured, rows } from "@/lib/database";
import type { RowDataPacket } from "@/lib/database";

export const runtime = "nodejs";

export async function GET(request: Request) {
  await assertDatabaseConfigured();
  if (!(await getStaffForRequest(request))) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const reports = await rows<RowDataPacket>(`SELECT reports.id,reports.reference,reports.user_id,reports.title,reports.category,reports.description,
    reports.status,reports.governorate,reports.city,reports.location,reports.image_type,reports.created_at,reports.updated_at,
    users.name AS user_name, users.phone AS user_phone
    FROM reports LEFT JOIN users ON users.id = reports.user_id ORDER BY reports.created_at DESC, reports.id DESC`);
  return NextResponse.json({ status: true, data: { reports } });
}


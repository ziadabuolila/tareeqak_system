import { NextResponse } from "next/server";
import { getRequestToken, getUserForToken } from "@/lib/auth";
import { assertDatabaseConfigured, rows, execute } from "@/lib/database";
import type { RowDataPacket } from "@/lib/database";

export const runtime = "nodejs";

export async function GET(request: Request) {
  await assertDatabaseConfigured();
  const user = await getUserForToken(await getRequestToken(request));
  if (!user || user.role !== "citizen") return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  await execute("UPDATE citizen_login_requests SET status='expired' WHERE citizen_id=? AND status='pending' AND expires_at<=CURRENT_TIMESTAMP", [user.id]);
  const requests = await rows<RowDataPacket>(`SELECT request_id,device_label,created_at,expires_at FROM citizen_login_requests
    WHERE citizen_id=? AND status='pending' ORDER BY created_at DESC`, [user.id]);
  return NextResponse.json({ status: true, data: { requests } }, { headers: { "Cache-Control": "no-store" } });
}

import { NextResponse } from "next/server";
import { getRequestToken, getUserForToken } from "@/lib/auth";
import { initializeDatabase, row } from "@/lib/database";
import type { RowDataPacket } from "mysql2/promise";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ reference: string }> }) {
  await initializeDatabase();
  const user = await getUserForToken(await getRequestToken(request));
  if (!user || user.role !== "citizen") {
    return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  }

  const { reference } = await context.params;
  const report = await row<{ image_data: Buffer | null; image_type: string | null } & RowDataPacket>(
    "SELECT image_data,image_type FROM reports WHERE reference=? AND user_id=? LIMIT 1",
    [reference, user.id],
  );
  if (!report?.image_data) return NextResponse.json({ message: "صورة البلاغ غير موجودة." }, { status: 404 });

  return new NextResponse(Buffer.from(report.image_data), {
    headers: {
      "Content-Type": report.image_type || "image/jpeg",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

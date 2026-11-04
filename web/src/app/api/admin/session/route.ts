import { NextResponse } from "next/server";
import { getAdminForRequest, publicUser } from "@/lib/auth";
import { initializeDatabase } from "@/lib/database";

export const runtime = "nodejs";

export async function GET(request: Request) {
  await initializeDatabase();
  const user = await getAdminForRequest(request);
  if (!user) return NextResponse.json({ message: "انتهت مدة الصلاحية." }, { status: 401 });
  return NextResponse.json({ status: true, data: { user: publicUser(user) } });
}

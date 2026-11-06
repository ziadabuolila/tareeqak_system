import { NextResponse } from "next/server";
import { getStaffForRequest, publicUser } from "@/lib/auth";
import { assertDatabaseConfigured } from "@/lib/database";

export const runtime = "nodejs";

export async function GET(request: Request) {
  await assertDatabaseConfigured();
  const user = await getStaffForRequest(request);
  if (!user) return NextResponse.json({ message: "انتهت مدة الصلاحية." }, { status: 401 });
  return NextResponse.json({ status: true, data: { user: publicUser(user) } });
}

import { NextResponse } from "next/server";
import { getRequestToken, getStaffForRequest, publicUser } from "@/lib/auth";
import { assertDatabaseConfigured, row } from "@/lib/database";
import type { RowDataPacket } from "@/lib/database";

export const runtime = "nodejs";

export async function GET(request: Request) {
  await assertDatabaseConfigured();
  const user = await getStaffForRequest(request);
  if (!user) {
    const token = await getRequestToken(request);
    const tokenId = Number(token?.split("|")[0]);
    const state = Number.isSafeInteger(tokenId) ? await row<{ status: string } & RowDataPacket>("SELECT users.status FROM personal_access_tokens JOIN users ON users.id=personal_access_tokens.tokenable_id WHERE personal_access_tokens.id=?", [tokenId]) : null;
    return NextResponse.json({ message: state?.status === "blocked" ? "تم إيقاف حسابك." : state ? "انتهت صلاحية الجلسة. سجّل الدخول مجددًا." : "تم حذف حسابك أو إلغاء جلستك." }, { status: 401 });
  }
  return NextResponse.json({ status: true, data: { user: publicUser(user) } });
}

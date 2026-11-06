import { NextResponse } from "next/server";
import { getAdminForRequest } from "@/lib/auth";
import { execute, assertDatabaseConfigured, row } from "@/lib/database";
import type { RowDataPacket } from "@/lib/database";

export const runtime = "nodejs";
const defaults = { siteName: "طريقك", region: "", email: "", notifications: true, weeklyReport: false };

export async function GET(request: Request) {
  await assertDatabaseConfigured();
  const user = await getAdminForRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const setting = await row<{ value: string } & RowDataPacket>("SELECT value FROM system_settings WHERE setting_key='general'");
  return NextResponse.json({ status: true, data: { settings: setting ? JSON.parse(setting.value) : { ...defaults, email: user.email ?? "" } } });
}

export async function PUT(request: Request) {
  await assertDatabaseConfigured();
  if (!(await getAdminForRequest(request))) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  let body: typeof defaults;
  try { body = await request.json(); } catch { return NextResponse.json({ message: "بيانات الإعدادات غير صالحة." }, { status: 422 }); }
  const settings = { siteName: String(body.siteName ?? "").trim(), region: String(body.region ?? "").trim(), email: String(body.email ?? "").trim(), notifications: Boolean(body.notifications), weeklyReport: Boolean(body.weeklyReport) };
  if (!settings.siteName || !settings.email || !/^\S+@\S+\.\S+$/.test(settings.email)) return NextResponse.json({ message: "اسم المنصة والبريد الصحيح مطلوبان." }, { status: 422 });
  await execute(`INSERT INTO system_settings(setting_key, value, updated_at)
    VALUES ('general', $1, NOW())
    ON CONFLICT (setting_key)
    DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`, [JSON.stringify(settings)]);
  return NextResponse.json({ status: true, data: { settings } });
}

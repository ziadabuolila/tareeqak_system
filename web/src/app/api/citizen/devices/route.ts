import { NextResponse } from "next/server";
import { getRequestToken, getUserForToken } from "@/lib/auth";
import { assertDatabaseConfigured, rows } from "@/lib/database";
import type { RowDataPacket } from "@/lib/database";
import { bindCurrentCitizenTokenToDevice, citizenDeviceIdPattern, isCitizenOwnerDevice, registerCitizenDevice } from "@/lib/citizen-devices";

export const runtime = "nodejs";

export async function GET(request: Request) {
  await assertDatabaseConfigured();
  const token = await getRequestToken(request);
  const user = await getUserForToken(token);
  if (!user || user.role !== "citizen") return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });

  const currentDeviceId = request.headers.get("x-device-id")?.trim().toLowerCase() ?? "";
  if (citizenDeviceIdPattern.test(currentDeviceId)) {
    if (!(await isCitizenOwnerDevice(user.id, currentDeviceId))) return NextResponse.json({ message: "إدارة الهواتف متاحة من هاتف صاحب الحساب الأساسي فقط." }, { status: 403 });
    const allowed = await registerCitizenDevice(user.id, currentDeviceId, request.headers.get("x-device-label") ?? "هاتف محمول");
    if (!allowed) return NextResponse.json({ message: "تم حظر هذا الهاتف من صاحب الحساب." }, { status: 403 });
    await bindCurrentCitizenTokenToDevice(token, user.id, currentDeviceId);
  } else return NextResponse.json({ message: "تعذر التحقق من هاتف صاحب الحساب." }, { status: 403 });

  const devices = await rows<RowDataPacket>(`SELECT device_id,device_label,status,first_seen_at,last_seen_at,blocked_at
    FROM citizen_devices WHERE citizen_id=? ORDER BY last_seen_at DESC,first_seen_at DESC`, [user.id]);
  return NextResponse.json({ status: true, data: { devices, current_device_id: currentDeviceId } }, { headers: { "Cache-Control": "no-store" } });
}

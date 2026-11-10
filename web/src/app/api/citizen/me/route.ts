import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getRequestToken, getUserForToken, publicUser } from "@/lib/auth";
import { database, execute, assertDatabaseConfigured, isDuplicateError, row } from "@/lib/database";
import type { RowDataPacket } from "@/lib/database";
import { bindCurrentCitizenTokenToDevice, citizenDeviceIdPattern, registerCitizenDevice } from "@/lib/citizen-devices";

export const runtime = "nodejs";
export async function GET(request: Request) {
  await assertDatabaseConfigured();
  const token = await getRequestToken(request);
  const user = await getUserForToken(token);
  if (!user || user.role !== "citizen") {
    // Keep invalid and revoked tokens generic; identify a still-valid token whose citizen was blocked.
    if (token) {
      const separator = token.indexOf("|");
      const tokenId = Number(token.slice(0, separator));
      const secret = separator > 0 ? token.slice(separator + 1) : "";
      if (Number.isSafeInteger(tokenId) && secret) {
        const tokenHash = createHash("sha256").update(secret).digest("hex");
        const blocked = await row<RowDataPacket>(`SELECT citizens.status FROM personal_access_tokens
          JOIN citizens ON citizens.id=personal_access_tokens.tokenable_id
          WHERE personal_access_tokens.id=? AND personal_access_tokens.token=? AND personal_access_tokens.tokenable_type=?
            AND (personal_access_tokens.expires_at IS NULL OR personal_access_tokens.expires_at>CURRENT_TIMESTAMP) LIMIT 1`,
        [tokenId, tokenHash, "App\\Models\\Citizen"]);
        if (blocked && blocked.status !== "active") {
          const deviceId = request.headers.get("x-device-id")?.trim() ?? "";
          if (citizenDeviceIdPattern.test(deviceId)) {
            await execute("UPDATE citizens SET primary_device_id=? WHERE id=(SELECT tokenable_id FROM personal_access_tokens WHERE id=?) AND primary_device_id IS NULL", [deviceId.toLowerCase(), tokenId]);
          }
          return NextResponse.json({ status: false, message: "تم إيقاف حسابك من النظام.", data: { reason: "account_blocked" } }, { status: 403 });
        }
      }
    }
    return NextResponse.json({ status: false, message: "Unauthenticated.", data: {} }, { status: 401 });
  }
  const deviceId = request.headers.get("x-device-id")?.trim() ?? "";
  if (citizenDeviceIdPattern.test(deviceId)) {
    const allowed = await registerCitizenDevice(user.id, deviceId, request.headers.get("x-device-label") ?? "هاتف محمول");
    if (!allowed) {
      await bindCurrentCitizenTokenToDevice(token, user.id, deviceId);
      const tokenId = Number(token?.split("|")[0] ?? "");
      if (Number.isSafeInteger(tokenId) && tokenId > 0) await execute("DELETE FROM personal_access_tokens WHERE id=? AND tokenable_id=? AND tokenable_type='App\\Models\\Citizen'", [tokenId, user.id]);
      return NextResponse.json({ status: false, message: "تم حظر هذا الهاتف من صاحب الحساب.", data: { reason: "device_blocked" } }, { status: 403 });
    }
    await bindCurrentCitizenTokenToDevice(token, user.id, deviceId);
    await execute("UPDATE citizens SET primary_device_id=? WHERE id=? AND primary_device_id IS NULL", [deviceId.toLowerCase(), user.id]);
  }
  const profile = await row<RowDataPacket>("SELECT name,email,phone,gender,age,address,governorate,city,national_id FROM citizens WHERE id=? LIMIT 1", [user.id]);
  const required = ["email", "gender", "age", "address", "governorate", "city", "national_id"];
  const missingFields = required.filter((field) => !String(profile?.[field] ?? "").trim());
  return NextResponse.json({ status: true, message: "User retrieved successfully", data: { user: publicUser(user), profile, profile_complete: missingFields.length === 0, profile_missing_fields: missingFields } });
}

export async function PATCH(request: Request) {
  await assertDatabaseConfigured();
  const token = await getRequestToken(request);
  const user = await getUserForToken(token);
  if (!user || user.role !== "citizen") {
    return NextResponse.json({ status: false, message: "Unauthenticated.", data: {} }, { status: 401 });
  }

  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ message: "بيانات الحساب غير صالحة." }, { status: 422 });
  }

  const name = typeof input.name === "string" ? input.name.trim() : "";
  const phone = typeof input.phone === "string" ? input.phone.trim() : "";
  if (name.length < 3 || name.length > 255 || !/^01[0125]\d{8}$/.test(phone)) {
    return NextResponse.json({ message: "أدخل اسمًا صحيحًا ورقم هاتف مصريًا مكوّنًا من 11 رقمًا." }, { status: 422 });
  }

  const duplicate = await row<RowDataPacket>("SELECT id FROM citizens WHERE phone=? AND id<>? LIMIT 1", [phone, user.id]);
  if (duplicate) {
    return NextResponse.json({ message: "رقم الهاتف مستخدم بالفعل." }, { status: 409 });
  }

  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      "UPDATE citizens SET name=?,phone=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      [name, phone, user.id],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    if (isDuplicateError(error)) {
      return NextResponse.json({ message: "رقم الهاتف مستخدم بالفعل." }, { status: 409 });
    }
    return NextResponse.json({ message: "تعذر حفظ بيانات الحساب." }, { status: 500 });
  } finally {
    connection.release();
  }

  const updatedUser = await row<typeof user & RowDataPacket>("SELECT id,name,phone,email,NULL AS email_verified_at,created_at,updated_at,'citizen' AS role,status FROM citizens WHERE id=?", [user.id]);
  return NextResponse.json({ status: true, data: { user: publicUser(updatedUser) } });
}

export async function DELETE(request: Request) {
  await assertDatabaseConfigured();
  const token = await getRequestToken(request);
  const user = await getUserForToken(token);
  if (!user || user.role !== "citizen" || !token) return NextResponse.json({ status: false, message: "Unauthenticated.", data: {} }, { status: 401 });
  const tokenId = Number(token.slice(0, token.indexOf("|")));
  await execute("DELETE FROM personal_access_tokens WHERE id = ?", [tokenId]);
  return NextResponse.json({ status: true, message: "Logged out successfully", data: {} });
}



import { NextResponse } from "next/server";
import { getRequestToken, getUserForToken, publicUser } from "@/lib/auth";
import { database, execute, assertDatabaseConfigured, isDuplicateError, row } from "@/lib/database";
import type { RowDataPacket } from "@/lib/database";

export const runtime = "nodejs";

export async function GET(request: Request) {
  await assertDatabaseConfigured();
  const token = await getRequestToken(request);
  const user = await getUserForToken(token);
  if (!user || user.role !== "citizen") return NextResponse.json({ status: false, message: "Unauthenticated.", data: {} }, { status: 401 });
  return NextResponse.json({ status: true, message: "User retrieved successfully", data: { user: publicUser(user) } });
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

  const duplicate = await row<RowDataPacket>(
    "SELECT id FROM users WHERE phone=? AND id<>? LIMIT 1",
    [phone, user.id],
  );
  if (duplicate) {
    return NextResponse.json({ message: "رقم الهاتف مستخدم بالفعل." }, { status: 409 });
  }

  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      "UPDATE users SET name=?,phone=?,email=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND role='citizen'",
      [name, phone, `${phone}@tareeqak.com.eg`, user.id],
    );
    await connection.execute(
      "UPDATE citizens SET name=?,phone=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?",
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

  const updatedUser = await row<typeof user & RowDataPacket>("SELECT * FROM users WHERE id=?", [user.id]);
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



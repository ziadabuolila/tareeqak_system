import { NextResponse } from "next/server";
import { getRequestToken, getUserForToken } from "@/lib/auth";
import { assertDatabaseConfigured, database, isDuplicateError, row } from "@/lib/database";
import type { RowDataPacket } from "@/lib/database";

export const runtime = "nodejs";

const requiredForCompletion = ["email", "gender", "age", "address", "governorate", "city", "national_id"] as const;
type CitizenProfile = {
  name: string; email: string | null; phone: string; gender: string | null; age: string | null; address: string | null;
  governorate: string; city: string; national_id: string | null;
};

function completion(profile: CitizenProfile) {
  const missing = requiredForCompletion.filter((key) => !String(profile[key] ?? "").trim());
  return { complete: missing.length === 0, missing_fields: missing };
}

async function currentCitizen(request: Request) {
  const user = await getUserForToken(await getRequestToken(request));
  return user?.role === "citizen" ? user : null;
}

export async function GET(request: Request) {
  await assertDatabaseConfigured();
  const user = await currentCitizen(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const profile = await row<CitizenProfile & RowDataPacket>(`SELECT citizens.name,citizens.email,citizens.phone,citizens.gender,citizens.age,citizens.address,
    citizens.governorate,citizens.city,citizens.national_id FROM citizens WHERE citizens.id=? LIMIT 1`, [user.id]);
  if (!profile) return NextResponse.json({ message: "بيانات المواطن غير موجودة." }, { status: 404 });
  return NextResponse.json({ status: true, data: { profile, ...completion(profile) } });
}

export async function PATCH(request: Request) {
  await assertDatabaseConfigured();
  const user = await currentCitizen(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  let input: Record<string, unknown>;
  try { input = await request.json(); } catch { return NextResponse.json({ message: "بيانات الملف غير صالحة." }, { status: 422 }); }

  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const gender = typeof input.gender === "string" ? input.gender.trim() : "";
  const age = typeof input.age === "string" || typeof input.age === "number" ? String(input.age).trim() : "";
  const address = typeof input.address === "string" ? input.address.trim() : "";
  const governorate = typeof input.governorate === "string" ? input.governorate.trim() : "";
  const city = typeof input.city === "string" ? input.city.trim() : "";
  const nationalId = typeof input.national_id === "string" ? input.national_id.trim() : "";
  if (!name) return NextResponse.json({ message: "لا يمكن حفظ البيانات بدون ملء خانة الاسم." }, { status: 422 });
  if (!email || email.length > 255 || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ message: "اكتب بريدًا إلكترونيًا صحيحًا." }, { status: 422 });
  }
  if (name.length > 255 || address.length > 2000 || governorate.length > 100 || city.length > 100 || nationalId.length > 100 || (age && (!/^\d{1,3}$/.test(age) || Number(age) > 130)) || (gender && !["male", "female", "other"].includes(gender))) {
    return NextResponse.json({ message: "تأكد من صحة البيانات المدخلة." }, { status: 422 });
  }

  const duplicateEmail = await row<RowDataPacket>("SELECT id FROM citizens WHERE LOWER(email)=? AND id<>? LIMIT 1", [email, user.id]);
  if (duplicateEmail) return NextResponse.json({ message: "البريد الإلكتروني مستخدم بالفعل." }, { status: 409 });

  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(`UPDATE citizens SET name=?,email=?,gender=?,age=?,address=?,governorate=?,city=?,national_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [name, email, gender || null, age || null, address || null, governorate, city, nationalId || null, user.id]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    if (isDuplicateError(error)) return NextResponse.json({ message: "البريد الإلكتروني مستخدم بالفعل." }, { status: 409 });
    throw error;
  } finally { connection.release(); }
  const profile = await row<CitizenProfile & RowDataPacket>(`SELECT citizens.name,citizens.email,citizens.phone,citizens.gender,citizens.age,citizens.address,
    citizens.governorate,citizens.city,citizens.national_id FROM citizens WHERE citizens.id=? LIMIT 1`, [user.id]);
  if (!profile) return NextResponse.json({ message: "تعذر تحميل الملف بعد الحفظ." }, { status: 500 });
  return NextResponse.json({ status: true, message: "تم حفظ بيانات المواطن.", data: { profile, ...completion(profile) } });
}

import { NextResponse } from "next/server";
import { getRequestToken, getUserForToken } from "@/lib/auth";
import { database, assertDatabaseConfigured, row, rows } from "@/lib/database";
import type { RowDataPacket } from "@/lib/database";
export const runtime = "nodejs";

export async function GET(request: Request) {
  await assertDatabaseConfigured();
  const user = await getUserForToken(await getRequestToken(request));
  if (!user || (user as typeof user & { role?: string }).role !== "citizen") return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const reports = await rows<RowDataPacket>(`SELECT id,reference,title,category,description,status,governorate,city,location,image_type,created_at,updated_at
    FROM reports WHERE user_id=? ORDER BY created_at DESC,id DESC`, [user.id]);
  return NextResponse.json({ status: true, data: { reports } });
}

export async function POST(request: Request) {
  await assertDatabaseConfigured();
  const user = await getUserForToken(await getRequestToken(request));
  if (!user || (user as typeof user & { role?: string }).role !== "citizen") return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ message: "بيانات البلاغ غير صالحة." }, { status: 422 }); }
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const location = typeof body.location === "string" ? body.location.trim() : "";
  const citizen = await row<{ governorate: string; city: string } & RowDataPacket>("SELECT governorate,city FROM citizens WHERE user_id=? LIMIT 1", [user.id]);
  const governorate = typeof body.governorate === "string" ? body.governorate.trim() : citizen?.governorate ?? "";
  const city = typeof body.city === "string" ? body.city.trim() : citizen?.city ?? "";
  if (!category || !description || !location) return NextResponse.json({ message: "التصنيف والوصف والموقع مطلوبة." }, { status: 422 });
  const imageBase64 = typeof body.image_base64 === "string" ? body.image_base64 : "";
  if (imageBase64.length > 5_600_000) return NextResponse.json({ message: "حجم الصورة أكبر من المسموح (4 ميجابايت)." }, { status: 413 });
  let imageData: Buffer | null = null;
  if (imageBase64) {
    try { imageData = Buffer.from(imageBase64, "base64"); } catch { return NextResponse.json({ message: "تعذر قراءة صورة البلاغ." }, { status: 422 }); }
    if (!imageData.length || imageData.length > 4 * 1024 * 1024) return NextResponse.json({ message: "حجم الصورة أكبر من المسموح (4 ميجابايت)." }, { status: 413 });
  }
  const reference = `TRQ-${crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase()}`;
  const connection = await database.getConnection();
  let reportId = 0;
  try {
    await connection.beginTransaction();
    const insertResult = await connection.execute(`INSERT INTO reports(reference,user_id,title,category,description,governorate,city,location,image_url,image_data,image_type)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING id`, [reference, user.id, category, category, description, governorate, city, location, null, imageData, imageData ? "image/jpeg" : null]);
    reportId = Number((insertResult.rows?.[0]?.id as number | string | null | undefined) ?? 0);
    await connection.execute("INSERT INTO notifications(title,body,kind) VALUES($1,$2,$3)", ["بلاغ جديد يحتاج للمراجعة", `تم تسجيل البلاغ ${reference} في ${city || location}.`, "warning"]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  const report = await row<RowDataPacket>("SELECT id,reference,user_id,title,category,description,status,governorate,city,location,image_type,created_at,updated_at FROM reports WHERE id=?", [reportId]);
  return NextResponse.json({ status: true, message: "Report created successfully", data: { report } }, { status: 201 });
}

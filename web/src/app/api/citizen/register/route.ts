import { NextResponse } from "next/server";
import { hashPassword, publicUser, type AuthenticatedUser } from "@/lib/auth";
import { database, assertDatabaseConfigured, isDuplicateError, row } from "@/lib/database";
import type { RowDataPacket } from "@/lib/database";

export const runtime = "nodejs";

function failure(message: string, status: number, errors?: Record<string, string[]>) {
  return NextResponse.json({ status: false, message, data: {}, ...(errors ? { errors } : {}) }, { status });
}

export async function POST(request: Request) {
  await assertDatabaseConfigured();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failure("The given data was invalid.", 422, { name: ["A valid JSON body is required."] });
  }

  const input = body as Record<string, unknown> | null;
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  const phone = typeof input?.phone === "string" ? input.phone.trim() : "";
  const governorate = typeof input?.governorate === "string" ? input.governorate.trim() : "";
  const city = typeof input?.city === "string" ? input.city.trim() : "";
  const password = typeof input?.password === "string" ? input.password : "";
  const confirmation = typeof input?.password_confirmation === "string" ? input.password_confirmation : "";
  const errors: Record<string, string[]> = {};

  if (!name) errors.name = ["The name field is required."];
  else if (name.length > 255) errors.name = ["The name field must not be greater than 255 characters."];
  if (!phone) errors.phone = ["The phone field is required."];
  else if (phone.length > 255) errors.phone = ["The phone field must not be greater than 255 characters."];
  else if ((await row<RowDataPacket>("SELECT 1 FROM citizens WHERE phone=? LIMIT 1", [phone]))) errors.phone = ["The phone has already been taken."];
  if (!governorate) errors.governorate = ["The governorate field is required."];
  else if (governorate.length > 100) errors.governorate = ["The governorate field must not be greater than 100 characters."];
  if (!city) errors.city = ["The city field is required."];
  else if (city.length > 100) errors.city = ["The city field must not be greater than 100 characters."];
  if (!password) errors.password = ["The password field is required."];
  else if (password.length < 6) errors.password = ["The password field must be at least 6 characters."];
  if (password !== confirmation) errors.password = ["The password field confirmation does not match."];
  if (Object.keys(errors).length) return failure("The given data was invalid.", 422, errors);

  try {
    const passwordHash = await hashPassword(password);
    const connection = await database.getConnection();
    let citizenId = 0;
    try {
      await connection.beginTransaction();
      const result = await connection.execute(`
        INSERT INTO citizens (name,email,phone,password,governorate,city,status,created_at,updated_at)
        VALUES (?,?,?,?,?,?,'active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
      `, [name, null, phone, passwordHash, governorate, city]);
      citizenId = Number(result.insertId ?? 0);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    const citizen = await row<AuthenticatedUser & RowDataPacket>("SELECT id,name,email,phone,password,status,created_at,updated_at,'citizen' AS role FROM citizens WHERE id = ?", [citizenId]);

    return NextResponse.json({
      status: true,
      message: "Registration successful",
      data: { user: publicUser(citizen) },
    }, { status: 201 });
  } catch (error) {
    if (isDuplicateError(error)) {
      return failure("The given data was invalid.", 422, { phone: ["The phone has already been taken."] });
    }
    return failure("Registration failed", 500);
  }
}




import { NextResponse } from "next/server";
import { createToken, hashPassword, publicUser, type AuthenticatedUser } from "@/lib/auth";
import { database, initializeDatabase, row } from "@/lib/database";
import type { RowDataPacket } from "mysql2/promise";

export const runtime = "nodejs";

function failure(message: string, status: number, errors?: Record<string, string[]>) {
  return NextResponse.json({ status: false, message, data: {}, ...(errors ? { errors } : {}) }, { status });
}

export async function POST(request: Request) {
  await initializeDatabase();
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
  else if ((await row<RowDataPacket>("SELECT 1 FROM users WHERE phone=? UNION SELECT 1 FROM citizens WHERE phone=? LIMIT 1", [phone, phone]))) errors.phone = ["The phone has already been taken."];
  if (!governorate) errors.governorate = ["The governorate field is required."];
  else if (governorate.length > 100) errors.governorate = ["The governorate field must not be greater than 100 characters."];
  if (!city) errors.city = ["The city field is required."];
  else if (city.length > 100) errors.city = ["The city field must not be greater than 100 characters."];
  if (!password) errors.password = ["The password field is required."];
  else if (password.length < 6) errors.password = ["The password field must be at least 6 characters."];
  if (password !== confirmation) errors.password = ["The password field confirmation does not match."];
  if (Object.keys(errors).length) return failure("The given data was invalid.", 422, errors);

  const email = `${phone}@tareeqak.com.eg`;
  if (await row<RowDataPacket>("SELECT 1 FROM users WHERE email = ? LIMIT 1", [email])) {
    return failure("Email already exists.", 422);
  }

  try {
    const passwordHash = await hashPassword(password);
    const connection = await database.getConnection();
    let userId = 0;
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute<import("mysql2/promise").ResultSetHeader>(`
        INSERT INTO users (name, phone, email, password, created_at, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [name, phone, email, passwordHash]);
      userId = result.insertId;
      await connection.execute(`
        INSERT INTO citizens (user_id, name, governorate, city, phone, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [userId, name, governorate, city, phone]);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    const user = await row<AuthenticatedUser & RowDataPacket>("SELECT * FROM users WHERE id = ?", [userId]);
    const token = await createToken(userId);

    return NextResponse.json({
      status: true,
      message: "Registration successful",
      data: { user: publicUser(user), token, token_type: "Bearer" },
    }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ER_DUP_ENTRY") {
      return failure("The given data was invalid.", 422, { phone: ["The phone has already been taken."] });
    }
    return failure("Registration failed", 500);
  }
}




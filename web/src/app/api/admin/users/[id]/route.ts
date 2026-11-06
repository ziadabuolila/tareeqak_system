import { NextResponse } from "next/server";
import { getAdminForRequest } from "@/lib/auth";
import { execute, assertDatabaseConfigured, isDuplicateError, rows } from "@/lib/database";
import type { RowDataPacket } from "@/lib/database";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  await assertDatabaseConfigured();
  const admin = await getAdminForRequest(request);
  if (!admin) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const id = Number((await context.params).id);
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ message: "بيانات غير صالحة." }, { status: 422 }); }
  if (!Number.isSafeInteger(id)) return NextResponse.json({ message: "رقم الحساب غير صالح." }, { status: 422 });
  if (body.status !== undefined) {
    if (!["active","blocked"].includes(String(body.status))) return NextResponse.json({ message: "الحالة غير صالحة." }, { status: 422 });
    if (id === admin.id && body.status === "blocked") return NextResponse.json({ message: "لا يمكن إيقاف حسابك الحالي." }, { status: 422 });
    const result = await execute("UPDATE users SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", [String(body.status),id]);
    if (!result.affectedRows) return NextResponse.json({ message: "الحساب غير موجود." }, { status: 404 });
    return NextResponse.json({ status: true });
  }
  const fields: Record<string, unknown> = {
    name: body.name, email: body.email, phone: body.phone, role: body.role,
    employee_number: body.employee_number, job_title: body.job_title, department: body.department,
    employment_type: body.employment_type, hire_date: body.hire_date, birth_date: body.birth_date,
    gender: body.gender, national_id: body.national_id, address: body.address,
    emergency_contact_name: body.emergency_contact_name, emergency_contact_phone: body.emergency_contact_phone,
    salary: body.salary, notes: body.notes,
  };
  const columns: Record<string, string> = {
    name: "name", email: "email", phone: "phone", role: "role", employee_number: "employee_number",
    job_title: "job_title", department: "department", employment_type: "employment_type", hire_date: "hire_date",
    birth_date: "birth_date", gender: "gender", national_id: "national_id", address: "address",
    emergency_contact_name: "emergency_contact_name", emergency_contact_phone: "emergency_contact_phone", salary: "salary", notes: "notes",
  };
  const values: (string | number | null)[] = [];
  const assignments: string[] = [];
  for (const [key, column] of Object.entries(columns)) {
    if (fields[key] === undefined) continue;
    let value = fields[key];
    if (key === "role" && !["employee", "manager"].includes(String(value))) return NextResponse.json({ message: "الدور غير صالح." }, { status: 422 });
    if (["hire_date", "birth_date"].includes(key) && value !== "" && value != null && (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))) return NextResponse.json({ message: "التاريخ غير صالح." }, { status: 422 });
    if (key === "salary" && value !== "" && value != null && (!Number.isFinite(Number(value)) || Number(value) < 0)) return NextResponse.json({ message: "قيمة الراتب غير صالحة." }, { status: 422 });
    if (typeof value === "string") value = value.trim();
    if (["email", "phone", "name"].includes(key) && !value) return NextResponse.json({ message: "الاسم والبريد والهاتف مطلوبة." }, { status: 422 });
    if (key === "email" && value && !/^\S+@\S+\.\S+$/.test(String(value))) return NextResponse.json({ message: "البريد الإلكتروني غير صالح." }, { status: 422 });
    if (key === "email" && value) value = String(value).toLowerCase();
    if (["salary"].includes(key) && value === "") value = null;
    if (["hire_date", "birth_date"].includes(key) && value === "") value = null;
    assignments.push(`${column}=?`); values.push((value as string | number | null) ?? null);
  }
  const password = typeof body.password === "string" ? body.password : "";
  if (password) {
    if (password.length < 8) return NextResponse.json({ message: "كلمة المرور يجب أن تكون 8 أحرف على الأقل." }, { status: 422 });
    const { hashPassword } = await import("@/lib/auth");
    assignments.push("password=?"); values.push(await hashPassword(password));
  }
  if (!assignments.length) return NextResponse.json({ message: "لا توجد بيانات للتحديث." }, { status: 422 });
  const previousUser = (await rows<{ email: string | null } & RowDataPacket>("SELECT email FROM users WHERE id=?", [id]))[0];
  if (!previousUser) return NextResponse.json({ message: "الحساب غير موجود." }, { status: 404 });
  const credentialsChanged = Boolean(password) || (typeof fields.email === "string" && fields.email.trim().toLowerCase() !== (previousUser.email ?? "").toLowerCase());
  values.push(id);
  let result;
  try { result = await execute(`UPDATE users SET ${assignments.join(",")},updated_at=CURRENT_TIMESTAMP WHERE id=?`, values); }
  catch (error) {
    if (isDuplicateError(error)) return NextResponse.json({ message: "البريد أو الهاتف أو الرقم الوظيفي مستخدم بالفعل." }, { status: 409 });
    throw error;
  }
  if (!result.affectedRows) return NextResponse.json({ message: "الحساب غير موجود." }, { status: 404 });
  if (credentialsChanged) await execute("DELETE FROM personal_access_tokens WHERE tokenable_id=?", [id]);
  const employee = (await rows<RowDataPacket>("SELECT id,name,email,phone,role,status,employee_number,job_title,department,employment_type,hire_date,birth_date,gender,national_id,address,emergency_contact_name,emergency_contact_phone,salary,notes,created_at FROM users WHERE id=?", [id]))[0];
  return NextResponse.json({ status: true, data: { employee } });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  await assertDatabaseConfigured();
  const admin = await getAdminForRequest(request);
  if (!admin) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const id = Number((await context.params).id);
  if (!Number.isSafeInteger(id) || id === admin.id) return NextResponse.json({ message: "لا يمكن حذف هذا الحساب." }, { status: 422 });
  const result = await execute("DELETE FROM users WHERE id=?", [id]);
  if (!result.affectedRows) return NextResponse.json({ message: "الحساب غير موجود." }, { status: 404 });
  return NextResponse.json({ status: true });
}

import { NextResponse } from "next/server";
import { hashPassword, getAdminForRequest } from "@/lib/auth";
import { execute, assertDatabaseConfigured, isDuplicateError, rows } from "@/lib/database";
import type { RowDataPacket } from "@/lib/database";

export const runtime = "nodejs";

export async function GET(request: Request) {
  await assertDatabaseConfigured();
  if (!(await getAdminForRequest(request))) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const citizens = await rows<RowDataPacket>(`SELECT users.id,users.name,users.email,users.phone,users.status,citizens.city,citizens.governorate,citizens.age,citizens.address,citizens.national_id,citizens.gender,citizens.created_at AS citizen_created_at,
    (SELECT COUNT(*) FROM reports WHERE reports.user_id=users.id) AS reports
    FROM users JOIN citizens ON citizens.user_id=users.id WHERE users.role='citizen' ORDER BY users.created_at DESC`);
  let employees: RowDataPacket[];
  try {
    employees = await rows<RowDataPacket>("SELECT id,name,email,phone,role,status,employee_number,job_title,department,employment_type,hire_date,birth_date,gender,national_id,address,emergency_contact_name,emergency_contact_phone,salary,notes,created_at FROM users WHERE role IN ('admin','manager','employee') ORDER BY created_at DESC");
  } catch (error) {
    console.error("Unable to read extended employee profile fields; returning legacy fields:", error);
    employees = await rows<RowDataPacket>("SELECT id,name,email,phone,role,status,created_at FROM users WHERE role IN ('admin','manager','employee') ORDER BY created_at DESC");
  }
  return NextResponse.json({ status: true, data: { citizens, employees } });
}

export async function POST(request: Request) {
  await assertDatabaseConfigured();
  if (!(await getAdminForRequest(request))) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ message: "بيانات الحساب غير صالحة." }, { status: 422 }); }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = ["manager", "employee"].includes(String(body.role)) ? String(body.role) : "employee";
  const employeeNumber = optionalText(body.employee_number);
  const jobTitle = optionalText(body.job_title);
  const department = optionalText(body.department);
  const employmentType = optionalChoice(body.employment_type, ["full_time", "part_time", "contract", "internship"]);
  const hireDate = optionalDate(body.hire_date);
  const birthDate = optionalDate(body.birth_date);
  const gender = optionalChoice(body.gender, ["male", "female", "other"]);
  const nationalId = optionalText(body.national_id);
  const address = optionalText(body.address);
  const emergencyName = optionalText(body.emergency_contact_name);
  const emergencyPhone = optionalText(body.emergency_contact_phone);
  const salary = body.salary === "" || body.salary == null ? null : Number(body.salary);
  const notes = optionalText(body.notes);
  if (body.salary !== "" && body.salary != null && (!Number.isFinite(salary) || (salary ?? -1) < 0)) return NextResponse.json({ message: "قيمة الراتب غير صالحة." }, { status: 422 });
  if (body.hire_date && !hireDate) return NextResponse.json({ message: "تاريخ التعيين غير صالح." }, { status: 422 });
  if (body.birth_date && !birthDate) return NextResponse.json({ message: "تاريخ الميلاد غير صالح." }, { status: 422 });
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || !phone || password.length < 8) return NextResponse.json({ message: "أدخل اسمًا وبريدًا صحيحًا وهاتفًا وكلمة مرور من 8 أحرف على الأقل." }, { status: 422 });
  try {
    const hash = await hashPassword(password);
    const result = await execute("INSERT INTO users(name,email,phone,password,role,employee_number,job_title,department,employment_type,hire_date,birth_date,gender,national_id,address,emergency_contact_name,emergency_contact_phone,salary,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id", [name,email,phone,hash,role,employeeNumber,jobTitle,department,employmentType,hireDate,birthDate,gender,nationalId,address,emergencyName,emergencyPhone,salary,notes]);
    const employee = (await rows<RowDataPacket>("SELECT id,name,email,phone,role,status,employee_number,job_title,department,employment_type,hire_date,birth_date,gender,national_id,address,emergency_contact_name,emergency_contact_phone,salary,notes,created_at FROM users WHERE id=?", [result.insertId]))[0];
    return NextResponse.json({ status: true, data: { employee } }, { status: 201 });
  } catch (error) {
    if (isDuplicateError(error)) return NextResponse.json({ message: "البريد أو الهاتف مستخدم بالفعل." }, { status: 409 });
    return NextResponse.json({ message: "تعذر إنشاء الحساب." }, { status: 500 });
  }
}

function optionalText(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
function optionalDate(value: unknown): string | null { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? value : null; }
function optionalChoice(value: unknown, allowed: string[]): string | null { return typeof value === "string" && allowed.includes(value) ? value : null; }

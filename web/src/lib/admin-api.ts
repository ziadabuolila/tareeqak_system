import { apiRequest } from "@/lib/api";
import { toast } from "sonner";

type LiveRow = Record<string, unknown> & { id?: number | string };
const liveSnapshots = new Map<string, string>();

const livePageNames: Record<string, string> = {
  "/": "لوحة التحكم",
  "/reports": "البلاغات",
  "/users": "المستخدمون",
  "/analytics": "الإحصائيات",
  "/map": "الخريطة",
};

function snapshotRows(rows: LiveRow[], fields: string[]) {
  return JSON.stringify(rows.map((row) => Object.fromEntries(fields.map((field) => [field, row[field] ?? null]))));
}

function announceLiveChanges(path: string, result: unknown) {
  if (typeof window === "undefined") return;

  const data = (result as { data?: Record<string, unknown> } | null)?.data;
  let key = "";
  let rows: LiveRow[] = [];
  let label = "";
  let fields: string[] = [];

  if (path === "/admin/reports" && Array.isArray(data?.reports)) {
    key = path;
    rows = data.reports as LiveRow[];
    label = "البلاغات";
    fields = ["id", "reference", "title", "status", "city", "governorate", "location", "user_name", "user_phone"];
  } else if (path === "/admin/users" && Array.isArray(data?.citizens)) {
    key = path;
    rows = [...(data.citizens as LiveRow[]), ...(Array.isArray(data.employees) ? data.employees as LiveRow[] : [])];
    label = "حسابات المستخدمين";
    fields = ["id", "name", "phone", "status", "city", "governorate", "profile_complete", "role"];
  } else if (path === "/admin/account" && data?.user && typeof data.user === "object") {
    key = path;
    rows = [data.user as LiveRow];
    label = "بيانات الحساب";
    fields = ["id", "name", "email"];
  }
  if (!key) return;

  const current = snapshotRows(rows, fields);
  const previous = liveSnapshots.get(key);
  liveSnapshots.set(key, current);
  // The first response establishes a baseline; notifications are only for live changes.
  if (previous === undefined || previous === current) return;

  const pageName = livePageNames[window.location.pathname] ?? label;
  let description = `تم رصد تغيير جديد في بيانات ${label}.`;
  if (key === "/admin/reports") {
    const oldRows = JSON.parse(previous) as Array<Record<string, unknown>>;
    const oldById = new Map(oldRows.map((row) => [String(row.id), row]));
    const newById = new Map(rows.map((row) => [String(row.id), row]));
    const added = rows.filter((row) => !oldById.has(String(row.id))).length;
    const removed = oldRows.filter((row) => !newById.has(String(row.id))).length;
    const statusChanges = rows.filter((row) => {
      const old = oldById.get(String(row.id));
      return old && old.status !== row.status;
    }).length;
    const parts = [];
    if (added) parts.push(`إضافة ${added} بلاغ`);
    if (statusChanges) parts.push(`تحديث حالة ${statusChanges} بلاغ`);
    if (removed) parts.push(`حذف ${removed} بلاغ`);
    description = parts.length ? `${parts.join("، ")}.` : "تم تعديل بيانات أحد البلاغات.";
  } else if (key === "/admin/users") {
    const oldRows = JSON.parse(previous) as Array<Record<string, unknown>>;
    const rowKey = (row: Record<string, unknown>) => `${String(row.role ?? "citizen")}:${String(row.id)}`;
    const oldById = new Map(oldRows.map((row) => [rowKey(row), row]));
    const newById = new Map(rows.map((row) => [rowKey(row), row]));
    const added = rows.filter((row) => !oldById.has(rowKey(row))).length;
    const removed = oldRows.filter((row) => !newById.has(rowKey(row))).length;
    const updated = rows.filter((row) => {
      const old = oldById.get(rowKey(row));
      return old && JSON.stringify(fields.map((field) => old[field] ?? null)) !== JSON.stringify(fields.map((field) => row[field] ?? null));
    }).length;
    const parts = [];
    if (added) parts.push(`تسجيل ${added} حساب`);
    if (updated) parts.push(`تحديث ${updated} حساب`);
    if (removed) parts.push(`حذف ${removed} حساب`);
    description = parts.length ? `${parts.join("، ")}.` : "تم تعديل بيانات حساب مستخدم.";
  } else {
    description = "تم تحديث اسم أو بريد الحساب من النظام.";
  }

  toast.success(`تغيير في ${pageName}`, {
    description,
    duration: 6500,
    id: `live-change-${key}`,
  });
}

export function adminRequest<T>(path: string, options: RequestInit = {}) {
  if (typeof window === "undefined") return apiRequest<T>(path, options);
  const method = (options.method ?? "GET").toUpperCase();
  const toastId = method === "GET" ? undefined : toast.loading("جارٍ تنفيذ العملية...");
  return apiRequest<T>(path, options, localStorage.getItem("tareeqak_admin_token") ?? undefined)
    .then((result) => {
      if (toastId) toast.success("تمت العملية بنجاح", { id: toastId });
      if (method === "GET") announceLiveChanges(path, result);
      return result;
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "حدث خطأ غير متوقع.";
      if (toastId) toast.error(message, { id: toastId });
      throw error;
    });
}

export type ReportRow = {
  id: number;
  reference: string;
  title: string;
  category: string;
  description: string;
  status: "pending" | "in_progress" | "resolved" | "rejected";
  city: string;
  governorate: string;
  location: string;
  created_at: string;
  user_name: string | null;
  user_phone: string | null;
  image_type?: string | null;
  image_base64?: string | null;
};
export type UserRow = {
  id: number;
  name: string;
  email: string | null;
  phone: string;
  city?: string;
  governorate?: string;
  age?: string | null; citizen_created_at?: string | null;
  profile_complete?: boolean;
  reports?: number;
  role?: string;
  status: "active" | "blocked";
  employee_number?: string | null; job_title?: string | null; department?: string | null; employment_type?: string | null;
  hire_date?: string | null; birth_date?: string | null; gender?: string | null; national_id?: string | null; address?: string | null;
  emergency_contact_name?: string | null; emergency_contact_phone?: string | null; salary?: number | string | null; notes?: string | null; created_at?: string;
};
export type NoticeRow = { id: number; title: string; body: string; created_at: string; kind: "info" | "warning" | "success"; read: number };
export const statusLabel: Record<ReportRow["status"], string> = {
  pending: "جديد", in_progress: "قيد المعالجة", resolved: "تم الحل", rejected: "مرفوض",
};

export function reportLocationLabel(value: string | null | undefined) {
  const location = value?.trim() ?? "";
  const match = location.match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,،]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!match) return location || "—";
  return `GPS · ${Number(match[1]).toFixed(5)}، ${Number(match[2]).toFixed(5)}`;
}

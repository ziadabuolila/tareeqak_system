import { apiRequest } from "@/lib/api";
import { toast } from "sonner";

export function adminRequest<T>(path: string, options: RequestInit = {}) {
  if (typeof window === "undefined") return apiRequest<T>(path, options);
  const method = (options.method ?? "GET").toUpperCase();
  const toastId = method === "GET" ? undefined : toast.loading("جارٍ تنفيذ العملية...");
  return apiRequest<T>(path, options, localStorage.getItem("tareeqak_admin_token") ?? undefined)
    .then((result) => {
      if (toastId) toast.success("تمت العملية بنجاح", { id: toastId });
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

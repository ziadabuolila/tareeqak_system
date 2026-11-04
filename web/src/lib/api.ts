export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "/api"
).replace(/\/$/, "");
export type ReportStatus = "pending" | "in_progress" | "resolved" | "rejected";
export type Report = {
  id: number;
  reference: string;
  title: string;
  category: string;
  status: ReportStatus;
  city?: string | null;
  created_at?: string;
  user?: { name?: string; email?: string };
};
export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  )
    headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(body.message || `فشل الطلب (${response.status})`);
  return body as T;
}


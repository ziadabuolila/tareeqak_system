"use client";
import { useEffect, useState } from "react";

export function useAdminNoticeCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const token = localStorage.getItem("tareeqak_admin_token");
    if (!token) return;
    fetch("/api/admin/notifications", { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((result: { data?: { notifications?: Array<{ read: number }> } } | null) => setCount(result?.data?.notifications?.filter((notice) => !notice.read).length ?? 0))
      .catch(() => setCount(0));
  }, []);
  return count;
}

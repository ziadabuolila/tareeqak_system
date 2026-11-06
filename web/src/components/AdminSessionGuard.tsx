"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { LoaderCircle } from "lucide-react";

export default function AdminSessionGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const checking = useRef(false);
  const [blocked, setBlocked] = useState("");

  useEffect(() => {
    if (pathname === "/login") { setBlocked(""); return; }
    const check = async () => {
      const token = localStorage.getItem("tareeqak_admin_token");
      if (!token) { router.replace("/login"); return; }
      if (checking.current) return;
      checking.current = true;
      try {
        const response = await fetch("/api/admin/session", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        if (response.status === 401 || response.status === 403) {
          const detail = await response.json().catch(() => null) as { message?: string } | null;
          setBlocked(detail?.message ?? "تم إيقاف حسابك.");
          localStorage.removeItem("tareeqak_admin_token");
          toast.error(detail?.message ?? "تم إيقاف حسابك. سجّل الدخول بحساب صالح.", { duration: 5000 });
          window.setTimeout(() => router.replace("/login"), 900);
        }
      } catch { /* Keep the current session during temporary network loss. */ }
      finally { checking.current = false; }
    };
    void check();
    const timer = window.setInterval(() => { if (!document.hidden) void check(); }, 10_000);
    return () => window.clearInterval(timer);
  }, [pathname, router]);

  return blocked ? <div className="session-block-overlay" role="alert"><div><LoaderCircle size={38} /><b>{blocked}</b><span>جارٍ تحويلك إلى تسجيل الدخول…</span></div></div> : null;
}

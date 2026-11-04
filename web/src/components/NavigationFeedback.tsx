"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

const IDLE_TIMEOUT_MS = 60 * 60 * 1000;
const ACTIVITY_KEY = "tareeqak_admin_last_activity";
const TOKEN_KEY = "tareeqak_admin_token";

export default function NavigationFeedback({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const pendingPath = useRef<string | null>(null);
  const prefetchedPaths = useRef(new Set<string>());
  const previousPath = useRef(pathname);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [verifiedPath, setVerifiedPath] = useState<string | null>(null);
  const expirationStarted = useRef(false);

  useEffect(() => {
    const startLogout = () => setIsLoggingOut(true);
    window.addEventListener("tareeqak:logout-start", startLogout);
    return () => window.removeEventListener("tareeqak:logout-start", startLogout);
  }, []);

  useEffect(() => {
    if (pathname !== previousPath.current) {
      previousPath.current = pathname;
      pendingPath.current = null;
      setIsNavigating(false);
    }
    if (pathname === "/login" && isLoggingOut) {
      const timeout = window.setTimeout(() => setIsLoggingOut(false), 450);
      return () => window.clearTimeout(timeout);
    }
  }, [pathname, isLoggingOut]);

  useEffect(() => {
    let idleTimer = 0;
    let interval = 0;
    let alive = true;
    let lastServerActivity = 0;
    let lastLocalActivity = 0;
    const isLoginPage = pathname === "/login";

    const stopTimer = () => {
      window.clearTimeout(idleTimer);
      window.clearInterval(interval);
    };
    const redirectToLogin = (showExpired: boolean) => {
      if (expirationStarted.current) return;
      expirationStarted.current = true;
      stopTimer();
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem("tareeqak_admin_name");
      localStorage.removeItem("tareeqak_admin_email");
      localStorage.removeItem(ACTIVITY_KEY);
      if (showExpired) {
        toast.error("انتهت مدة الصلاحية. سجّل الدخول مرة أخرى.", { duration: 1000 });
        window.setTimeout(() => window.location.replace("/login"), 1000);
      } else {
        window.location.replace("/login");
      }
    };
    const armIdleTimer = () => {
      stopTimer();
      const lastActivity = Number(localStorage.getItem(ACTIVITY_KEY) || Date.now());
      const remaining = IDLE_TIMEOUT_MS - (Date.now() - lastActivity);
      if (remaining <= 0) {
        redirectToLogin(true);
        return;
      }
      idleTimer = window.setTimeout(() => redirectToLogin(true), remaining);
      interval = window.setInterval(() => {
        const refreshedActivity = Number(localStorage.getItem(ACTIVITY_KEY) || lastActivity);
        if (Date.now() - refreshedActivity >= IDLE_TIMEOUT_MS) redirectToLogin(true);
      }, 15000);
    };
    const recordActivity = () => {
      if (expirationStarted.current) return;
      const now = Date.now();
      if (now - lastLocalActivity < 5000) return;
      lastLocalActivity = now;
      localStorage.setItem(ACTIVITY_KEY, String(now));
      armIdleTimer();
      if (now - lastServerActivity >= 5 * 60 * 1000) {
        lastServerActivity = now;
        const token = localStorage.getItem(TOKEN_KEY);
        if (token) {
          void fetch("/api/admin/session", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
            .then((response) => {
              if (response.status === 401) redirectToLogin(true);
              else if (!response.ok) toast.error("تعذّر تحديث صلاحية الجلسة.");
            })
            .catch(() => toast.error("تعذّر الاتصال بالخادم لتحديث الجلسة."));
        }
      }
    };
    const verify = async () => {
      if (!alive) return;
      setVerifiedPath(null);
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        if (isLoginPage) setVerifiedPath(pathname);
        else redirectToLogin(false);
        return;
      }
      const lastActivity = Number(localStorage.getItem(ACTIVITY_KEY) || Date.now());
      if (Date.now() - lastActivity >= IDLE_TIMEOUT_MS) {
        redirectToLogin(true);
        return;
      }
      try {
        const response = await fetch("/api/admin/session", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!response.ok) {
          redirectToLogin(true);
          return;
        }
        const result = await response.json();
        const user = result.data?.user as { name?: string; email?: string; role?: string } | undefined;
        if (!user || !["admin", "manager", "employee"].includes(user.role ?? "")) {
          redirectToLogin(false);
          return;
        }
        if (user.name) localStorage.setItem("tareeqak_admin_name", user.name);
        if (user.email) localStorage.setItem("tareeqak_admin_email", user.email);
        if (isLoginPage) {
          router.replace("/");
          return;
        }
        expirationStarted.current = false;
        armIdleTimer();
        setVerifiedPath(pathname);
      } catch {
        toast.error("تعذّر التحقق من الجلسة. تأكد من اتصال الخادم.");
        if (isLoginPage) setVerifiedPath(pathname);
      }
    };

    void verify();
    const activityEvents = ["pointerdown", "pointermove", "keydown", "touchstart", "wheel"] as const;
    const onStorage = (event: StorageEvent) => {
      if (event.key === TOKEN_KEY && !event.newValue && !isLoginPage) redirectToLogin(false);
      if (event.key === ACTIVITY_KEY && event.newValue) armIdleTimer();
    };
    const onPageShow = () => void verify();
    if (!isLoginPage) {
      for (const eventName of activityEvents) window.addEventListener(eventName, recordActivity, { passive: true });
      window.addEventListener("storage", onStorage);
      window.addEventListener("pageshow", onPageShow);
    }
    return () => {
      alive = false;
      stopTimer();
      for (const eventName of activityEvents) window.removeEventListener(eventName, recordActivity);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [pathname, router]);

  function getInternalLink(target: EventTarget | null) {
    if (!(target instanceof Element)) return null;

    const link = target.closest("a[href]");
    if (!(link instanceof HTMLAnchorElement)) return null;

    const destination = new URL(link.href, window.location.href);
    if (destination.origin !== window.location.origin) return null;

    return { link, destination };
  }

  function prefetchLink(target: EventTarget | null) {
    const internalLink = getInternalLink(target);
    if (!internalLink) return;

    const { destination } = internalLink;
    if (destination.pathname === pathname) return;

    const route = `${destination.pathname}${destination.search}`;
    if (prefetchedPaths.current.has(route)) return;

    prefetchedPaths.current.add(route);
    router.prefetch(route);
  }

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const internalLink = getInternalLink(event.target);
    if (!internalLink) return;

    const { link, destination } = internalLink;
    if (
      link.target === "_blank" ||
      link.hasAttribute("download") ||
      destination.pathname === pathname
    ) {
      return;
    }

    if (pendingPath.current === destination.pathname) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    pendingPath.current = destination.pathname;
    setIsNavigating(true);
  }

  return (
    <div
      className="navigation-feedback-root"
      aria-busy={isNavigating || isLoggingOut}
      onPointerOverCapture={(event) => prefetchLink(event.target)}
      onFocusCapture={(event) => prefetchLink(event.target)}
      onClickCapture={handleClick}
    >
      {isNavigating && !isLoggingOut && (
        <>
          <div className="route-navigation-progress" aria-hidden="true" />
          <div className="route-navigation-status" role="status" aria-live="polite">
            <LoaderCircle size={16} aria-hidden="true" />
            <span>جاري فتح الصفحة...</span>
          </div>
        </>
      )}
      {isLoggingOut && (
        <div className="logout-loading-overlay" role="status" aria-live="assertive">
          <div className="logout-loading-card">
            <div className="logout-loading-orbit" aria-hidden="true">
              <span />
              <LoaderCircle size={30} />
            </div>
            <span className="logout-loading-kicker">تم تسجيل الخروج</span>
            <strong>جارٍ تجهيز صفحة الدخول</strong>
            <p>لحظات وننقلك بأمان...</p>
            <div className="logout-loading-track" aria-hidden="true"><span /></div>
          </div>
        </div>
      )}
      {pathname === "/login" || verifiedPath === pathname ? children : null}
    </div>
  );
}

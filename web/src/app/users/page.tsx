"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import {
  Activity,
  Bell,
  ChartNoAxesCombined,
  ChevronDown,
  ClipboardList,
  FileText,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Menu,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  X,
  KeyRound,
} from "lucide-react";
import { useAdminNoticeCount } from "@/lib/use-admin-notice-count";
const nav = [
  { href: "/", label: "الرئيسية", icon: LayoutDashboard },
  { href: "/reports", label: "إدارة البلاغات", icon: ClipboardList },
  { href: "/users", label: "المستخدمون", icon: Users },
  { href: "/map", label: "خريطة البلاغات", icon: MapPinned },
  {
    href: "/analytics",
    label: "التقارير والإحصائيات",
    icon: ChartNoAxesCombined,
  },
  { href: "/notifications", label: "الإشعارات", icon: Bell },
  { href: "/catalog", label: "بيانات التطبيق", icon: Settings },
];
function PageFrame({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  const path = usePathname();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [profile, setProfile] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [name, setName] = useState("مسؤول النظام");
  const noticeCount = useAdminNoticeCount();
  useEffect(() => {
    setName(localStorage.getItem("tareeqak_admin_name") || "مسؤول النظام");
  }, []);
  function logout() {
    const token = localStorage.getItem("tareeqak_admin_token");
    if (token) void fetch("/api/citizen/me", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    localStorage.removeItem("tareeqak_admin_token");
    setLogoutConfirm(false);
    window.dispatchEvent(new Event("tareeqak:logout-start"));
    router.push("/login");
  }
  return (
    <div className="app-shell" dir="rtl">
      <aside className={`sidebar ${menu ? "sidebar-open" : ""}`}>
        <Link href="/" className="brand">
          <span className="brand-symbol">
            <MapPinned size={23} />
          </span>
          <span>
            <b>طريقك</b>
            <small>منصة البلاغات المجتمعية</small>
          </span>
        </Link>
        <div className="sidebar-caption">القائمة الرئيسية</div>
        <nav>
          {nav.map((item) => {
            const Icon = item.icon;
            const active = path === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${active ? "active" : ""}`}
                onClick={() => setMenu(false)}
              >
                <Icon size={19} />
                <span>{item.label}</span>
                {item.href === "/notifications" && noticeCount > 0 && (
                  <em>{noticeCount}</em>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-caption extra-caption">الإدارة</div>
        <nav>
          <Link
            className={`nav-link ${path === "/settings" ? "active" : ""}`}
            href="/settings"
          >
            <Settings size={19} />
            <span>الإعدادات</span>
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <span className="secure-icon">
            <ShieldCheck size={18} />
          </span>
          <div>
            <b>بيئة آمنة</b>
            <small>لوحة تحكم طريقك</small>
          </div>
          <span className="online-dot" />
        </div>
      </aside>
      {menu && (
        <button
          className="mobile-overlay"
          onClick={() => setMenu(false)}
          aria-label="إغلاق القائمة"
        />
      )}
      <section className="main-area">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMenu(!menu)}
            aria-label="القائمة"
          >
            {menu ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="breadcrumb">
            <span>طريقك</span>
            <b>/</b>
            <strong>{title}</strong>
          </div>
          <div className="topbar-actions">
            <Link
              href="/notifications"
              className="icon-button notification-button"
              aria-label="الإشعارات"
            >
              <Bell size={19} />
              {noticeCount > 0 && <i />}
            </Link>
            <span className="top-divider" />
            <div className="profile-wrap">
              <button
                className={`profile-button ${profile ? "opened" : ""}`}
                onClick={() => setProfile(!profile)}
              >
                <span className="avatar">{name.slice(0, 1)}</span>
                <span className="profile-copy">
                  <b>{name}</b>
                  <small>مسؤول النظام</small>
                </span>
                <ChevronDown size={16} />
              </button>
              {profile && (
                <>
                  <button
                    className="click-away"
                    onClick={() => setProfile(false)}
                    aria-label="إغلاق القائمة"
                  />
                  <div className="profile-menu">
                    <div className="profile-menu-head">
                      <span className="avatar">{name.slice(0, 1)}</span>
                      <div>
                        <b>{name}</b>
                        <small>
                          {localStorage.getItem("tareeqak_admin_email") ||
                            "البريد غير مسجل"}
                        </small>
                      </div>
                    </div>
                    <Link href="/account" onClick={() => setProfile(false)}>
                      <UserRound size={16} /> حسابي
                    </Link>
                    <Link href="/password" onClick={() => setProfile(false)}>
                      <KeyRound size={16} /> تغيير كلمة المرور
                    </Link>
                    <Link href="/settings" onClick={() => setProfile(false)}>
                      <Settings size={16} /> الإعدادات
                    </Link>
                    <button
                      className="logout-menu-item"
                      onClick={() => {
                        setProfile(false);
                        setLogoutConfirm(true);
                      }}
                    >
                      <LogOut size={16} /> تسجيل الخروج
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="page-content">
          <div className="page-heading">
            <div>
              <h1>{title}</h1>
              <p>تابع وأدر خدمات وبلاغات منصة طريقك بسهولة.</p>
            </div>
            <span className="live-label">
              <i /> النظام يعمل
            </span>
          </div>
          {children}
        </main>
      </section>
      {logoutConfirm && (
        <div className="modal-backdrop">
          <section className="confirm-modal logout-confirm-modal modal-panel" role="alertdialog" aria-modal="true" aria-labelledby="logout-confirm-title">
            <div className="confirm-icon">
              <LogOut size={24} />
            </div>
            <h2 id="logout-confirm-title">تأكيد تسجيل الخروج</h2>
            <p>هل أنت متأكد إنك عايز تسجل الخروج من لوحة تحكم طريقك؟</p>
            <div className="form-actions">
              <button
                className="btn btn-light"
                onClick={() => setLogoutConfirm(false)}
              >
                إلغاء
              </button>
              <button className="btn btn-danger" onClick={logout}>
                <LogOut size={16} /> تسجيل الخروج
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

import UsersPage from "@/components/pages/UsersPage";
export default function Page() {
  return (
    <PageFrame title="المستخدمون">
      <UsersPage />
    </PageFrame>
  );
}


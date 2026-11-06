"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Activity, ArrowUpLeft, ClipboardList, Clock3, CheckCircle2, Users, MapPin, Eye, TrendingUp } from "lucide-react";
import { adminRequest, UserRow, statusLabel } from "@/lib/admin-api";
import { useLiveReports } from "@/lib/use-live-reports";
import { InlineNumberLoader } from "@/components/InlineNumberLoader";
import { useLiveRefresh } from "@/lib/live-refresh";

export default function DashboardPage() {
  const { reports, loading: reportsLoading, error: reportsError } = useLiveReports();
  const [users, setUsers] = useState<UserRow[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const loadUsers = useCallback(() => {
    adminRequest<{ data: { citizens: UserRow[] } }>("/admin/users")
      .then((userResult) => { setUsers(userResult.data.citizens); })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "تعذر تحميل ملخص النظام."))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { void loadUsers(); }, [loadUsers]);
  useLiveRefresh(loadUsers);
  const stats = [
    { label:"إجمالي البلاغات", value:reports.length, sub:"البلاغات المسجلة", icon:ClipboardList, tone:"green" },
    { label:"بلاغات جديدة", value:reports.filter((r)=>r.status==="pending").length, sub:"تحتاج إلى مراجعة", icon:Clock3, tone:"orange" },
    { label:"قيد المعالجة", value:reports.filter((r)=>r.status==="in_progress").length, sub:"يتم العمل عليها", icon:Activity, tone:"blue" },
    { label:"تم حلها", value:reports.filter((r)=>r.status==="resolved").length, sub:"بلاغات مكتملة", icon:CheckCircle2, tone:"purple" },
  ];
  return <>
    {(error || reportsError) && <p className="error-message" role="alert">{error || reportsError}</p>}
    <div className="stats-grid">{stats.map((s)=>{const Icon=s.icon;return <article className="stat-card" key={s.label}><div className="stat-top"><span>{s.label}</span><span className={`stat-icon ${s.tone}`}><Icon size={21}/></span></div><div className="stat-value">{reportsLoading?<InlineNumberLoader label="جارٍ تحميل الإحصائية" />:s.value.toLocaleString("ar-EG")}</div><div className="stat-bottom">{s.sub}<small><TrendingUp size={13}/> من قاعدة البيانات</small></div></article>;})}</div>
    <div className="dashboard-grid"><section className="panel"><div className="panel-head"><div><h3>أحدث البلاغات</h3><p>آخر البلاغات المسجلة في النظام · تتحدث تلقائيًا</p></div><Link href="/reports" className="text-link">عرض الكل <ArrowUpLeft size={15}/></Link></div><div className="table-wrap"><table><thead><tr><th>رقم البلاغ</th><th>العنوان</th><th>المستخدم</th><th>الحالة</th><th>التفاصيل</th></tr></thead><tbody>{reports.slice(0,5).map((r)=><tr key={r.id}><td><span className="ref-code">{r.reference}</span></td><td><b className="table-title">{r.title}</b><small className="table-date">{r.city||r.location||"—"} · {r.created_at}</small></td><td>{r.user_name||r.user_phone||"—"}</td><td><span className={`status-pill ${r.status}`}><i/>{statusLabel[r.status]}</span></td><td><Link href="/reports" className="small-action"><Eye size={15}/> عرض</Link></td></tr>)}</tbody></table>{reportsLoading?<div className="empty-state">جارٍ تحميل البيانات...</div>:!reports.length&&<div className="empty-state">لا توجد بلاغات مسجلة حتى الآن.</div>}</div></section>
      <section className="panel overview-panel"><div className="panel-head"><div><h3>نظرة عامة</h3><p>ملخص بيانات المنصة</p></div><span className="soft-icon"><Activity size={19}/></span></div><div className="overview-stat"><span>المواطنون المسجلون</span><b>{loading?<InlineNumberLoader label="جارٍ تحميل عدد المواطنين" />:users.length.toLocaleString("ar-EG")}</b><Users size={19}/></div><div className="overview-stat"><span>نسبة حل البلاغات</span><b>{loading?<InlineNumberLoader label="جارٍ تحميل نسبة الحل" />:reports.length?Math.round(reports.filter((r)=>r.status==="resolved").length/reports.length*100):0}{loading?"":"٪"}</b><CheckCircle2 size={19}/></div><div className="overview-stat"><span>المناطق المسجلة</span><b>{loading?<InlineNumberLoader label="جارٍ تحميل عدد المناطق" />:new Set(reports.map((r)=>r.city).filter(Boolean)).size}</b><MapPin size={19}/></div><Link href="/analytics" className="btn btn-primary full-button">عرض التقارير والإحصائيات</Link></section></div>
    <div className="quick-grid"><Link href="/reports" className="quick-card"><span className="quick-icon"><ClipboardList size={20}/></span><span><b>إدارة البلاغات</b><small>مراجعة وتحديث الحالات</small></span><ArrowUpLeft size={17}/></Link><Link href="/users" className="quick-card"><span className="quick-icon"><Users size={20}/></span><span><b>إدارة المستخدمين</b><small>عرض الحسابات المسجلة</small></span><ArrowUpLeft size={17}/></Link><Link href="/map" className="quick-card"><span className="quick-icon"><MapPin size={20}/></span><span><b>توزيع البلاغات</b><small>حسب المناطق المسجلة</small></span><ArrowUpLeft size={17}/></Link></div>
  </>;
}


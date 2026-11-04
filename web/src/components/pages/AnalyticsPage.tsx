"use client";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, CheckCircle2, Clock3, ClipboardList, MapPin, Users } from "lucide-react";
import { adminRequest, UserRow } from "@/lib/admin-api";
import { useLiveReports } from "@/lib/use-live-reports";
import { InlineNumberLoader } from "@/components/InlineNumberLoader";

export default function AnalyticsPage() {
  const { reports, loading: reportsLoading, error: reportsError } = useLiveReports();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    adminRequest<{ data: { citizens: UserRow[] } }>("/admin/users")
      .then((userResult) => { setUsers(userResult.data.citizens); })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "تعذر تحميل الإحصائيات."))
      .finally(() => setLoading(false));
  }, []);

  const total = reports.length;
  const resolved = reports.filter((report) => report.status === "resolved").length;
  const pending = reports.filter((report) => report.status === "pending").length;
  const resolutionRate = total ? Math.round((resolved / total) * 100) : 0;
  const statuses = [
    { key: "pending", label: "جديد", color: "orange" },
    { key: "in_progress", label: "قيد المعالجة", color: "blue" },
    { key: "resolved", label: "تم الحل", color: "green" },
    { key: "rejected", label: "مرفوض", color: "red" },
  ] as const;
  const areas = useMemo(
    () => Array.from(new Set(reports.map((report) => report.city || report.governorate || report.location).filter(Boolean)))
      .map((city) => ({ city, count: reports.filter((report) => (report.city || report.governorate || report.location) === city).length }))
      .sort((first, second) => second.count - first.count),
    [reports],
  );

  return <>
    {(error || reportsError) && <p className="error-message" role="alert">{error || reportsError}</p>}
    <div className="stats-grid analytics-stats">
      <article className="stat-card"><div className="stat-top">إجمالي البلاغات <ClipboardList size={20} /></div><div className="stat-value">{loading ? <InlineNumberLoader label="جارٍ تحميل إجمالي البلاغات" /> : total}</div><div className="stat-bottom">من قاعدة البيانات</div></article>
      <article className="stat-card"><div className="stat-top">المواطنون <Users size={20} /></div><div className="stat-value">{loading ? <InlineNumberLoader label="جارٍ تحميل عدد المواطنين" /> : users.length}</div><div className="stat-bottom">حسابات فعلية مسجلة</div></article>
      <article className="stat-card"><div className="stat-top">نسبة الحل <CheckCircle2 size={20} /></div><div className="stat-value">{loading ? <InlineNumberLoader label="جارٍ تحميل نسبة الحل" /> : `${resolutionRate}٪`}</div><div className="stat-bottom">من البلاغات المسجلة</div></article>
      <article className="stat-card"><div className="stat-top">بانتظار المراجعة <Clock3 size={20} /></div><div className="stat-value">{loading ? <InlineNumberLoader label="جارٍ تحميل البلاغات الجديدة" /> : pending}</div><div className="stat-bottom">بلاغات جديدة</div></article>
    </div>
    <div className="dashboard-grid">
      <section className="panel">
        <div className="panel-head"><div><h3>توزيع البلاغات حسب الحالة</h3><p>الأعداد والنسب من البلاغات المسجلة</p></div><BarChart3 size={21} /></div>
        {loading ? <div className="analytics-skeleton-list" aria-label="جارٍ تحميل إحصائيات الحالات">{statuses.map((status) => <div className="analytics-skeleton-row" key={status.key}><span>{status.label}</span><InlineNumberLoader label={`جارٍ تحميل عدد بلاغات ${status.label}`} /></div>)}</div> : total ? statuses.map((status) => {
          const count = reports.filter((report) => report.status === status.key).length;
          return <div className="progress-row" key={status.key}><div className="progress-label"><span>{status.label}</span><b>{count} ({Math.round((count / total) * 100)}٪)</b></div><div className="progress-track"><span className={status.color} style={{ width: `${(count / total) * 100}%` }} /></div></div>;
        }) : <div className="empty-state">لا توجد بلاغات كافية لعرض إحصائيات.</div>}
      </section>
      <section className="panel">
        <div className="panel-head"><div><h3>البلاغات حسب المنطقة</h3><p>المناطق الواردة في البلاغات الفعلية</p></div><MapPin size={21} /></div>
        {loading ? <div className="analytics-skeleton-list" aria-label="جارٍ تحميل إحصائيات المناطق">{[1, 2, 3].map((key) => <div className="analytics-skeleton-row" key={key}><span className="analytics-skeleton-label" /><InlineNumberLoader label="جارٍ تحميل عدد البلاغات بالمنطقة" /></div>)}</div> : areas.length ? areas.map((area) => <div className="area-row" key={area.city}><span>{area.city}</span><b>{area.count}</b><div className="area-mini-track"><i style={{ width: `${total ? (area.count / total) * 100 : 0}%` }} /></div></div>) : <div className="empty-state">ستظهر المناطق بعد تسجيل البلاغات.</div>}
      </section>
    </div>
  </>;
}

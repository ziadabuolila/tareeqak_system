"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowUpLeft, CheckCircle2, ClipboardList, Clock3, Activity, MapPin, Users, Map as MapIcon, BarChart3 } from "lucide-react";
import { adminRequest, UserRow, statusLabel } from "@/lib/admin-api";
import { useLiveReports } from "@/lib/use-live-reports";
import { InlineNumberLoader } from "@/components/InlineNumberLoader";
import { useLiveRefresh } from "@/lib/live-refresh";

const num = (n: number) => n.toLocaleString("ar-EG");
const toDate = (s: string) => { const d = new Date(String(s).replace(" ", "T")); return isNaN(d.getTime()) ? null : d; };
const DAY = 86400000;

function Ring({ value }: { value: number }) {
  const r = 52, c = 2 * Math.PI * r;
  return <svg viewBox="0 0 130 130" className="cc-ring" role="img" aria-label={`نسبة الحل ${value}%`}>
    <circle cx="65" cy="65" r={r} className="cc-ring-bg" />
    <circle cx="65" cy="65" r={r} className="cc-ring-fg" strokeDasharray={c} strokeDashoffset={c - (c * value) / 100} transform="rotate(-90 65 65)" />
    <text x="65" y="62" textAnchor="middle" direction="ltr" className="cc-ring-num">{num(value)}٪</text>
    <text x="65" y="82" textAnchor="middle" className="cc-ring-cap">نسبة الحل</text>
  </svg>;
}
function Spark({ data }: { data: number[] }) {
  const max = Math.max(1, ...data);
  return <div className="cc-spark" aria-hidden="true">{data.map((v, i) => <i key={i} style={{ height: `${12 + (v / max) * 88}%` }} />)}</div>;
}

export default function DashboardPage() {
  const { reports, loading: reportsLoading, error: reportsError } = useLiveReports();
  const [users, setUsers] = useState<UserRow[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const loadUsers = useCallback(() => {
    adminRequest<{ data: { citizens: UserRow[] } }>("/admin/users")
      .then((r) => setUsers(r.data.citizens))
      .catch((c) => setError(c instanceof Error ? c.message : "مش قادرين نحمّل بيانات الملخص دلوقتي."))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { void loadUsers(); }, [loadUsers]);
  useLiveRefresh(loadUsers);

  const m = useMemo(() => {
    const by = (s: string) => reports.filter((r) => r.status === s);
    const total = reports.length, pending = by("pending"), prog = by("in_progress"), done = by("resolved"), rej = by("rejected");
    const rate = total ? Math.round((done.length / total) * 100) : 0;
    const now = Date.now();
    const week = Array.from({ length: 7 }, (_, i) => reports.filter((r) => { const d = toDate(r.created_at); return d && Math.floor((now - d.getTime()) / DAY) === 6 - i; }).length);
    const late = pending.filter((r) => { const d = toDate(r.created_at); return d && now - d.getTime() > 2 * DAY; });
    const areas = Object.entries(reports.reduce<Record<string, number>>((a, r) => { const k = r.city || r.governorate; if (k) a[k] = (a[k] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { total, pending, prog, done, rej, rate, week, late, areas };
  }, [reports]);
  const L = reportsLoading;
  const seg = (n: number) => (m.total ? (n / m.total) * 100 : 0);
  const hour = new Date().getHours();
  const hello = hour < 12 ? "صباح الخير" : hour < 18 ? "نهارك سعيد" : "مساء الخير";

  return <div className="cc">
    {(error || reportsError) && <p className="error-message" role="alert">{error || reportsError}</p>}

    <section className="cc-hero">
      <div className="cc-hero-copy">
        <span className="cc-chip"><i />مباشر · يتحدّث تلقائيًا</span>
        <h2>{hello} 👋<br />ده ملخص يومك</h2>
        <p>{L ? "بنحمّل البيانات..." : m.pending.length ? `عندك ${num(m.pending.length)} بلاغ جديد محتاج مراجعة${m.late.length ? `، منهم ${num(m.late.length)} متأخر أكتر من يومين` : ""}.` : "مفيش بلاغات جديدة معلّقة. شغل ممتاز!"}</p>
        <div className="cc-hero-actions">
          <Link href="/reports?view=pending" className="cc-btn cc-btn-accent">راجع البلاغات الجديدة</Link>
          <Link href="/map" className="cc-btn cc-btn-ghost"><MapIcon size={16} /> الخريطة</Link>
          <Link href="/analytics" className="cc-btn cc-btn-ghost"><BarChart3 size={16} /> التقارير</Link>
        </div>
      </div>
      <Ring value={L ? 0 : m.rate} />
    </section>

    <section className="cc-kpis">
      {[
        { l: "إجمالي البلاغات", v: m.total, t: "blue", I: ClipboardList, spark: m.week },
        { l: "جديد", v: m.pending.length, t: "amber", I: Clock3 },
        { l: "قيد المعالجة", v: m.prog.length, t: "sky", I: Activity },
        { l: "تم الحل", v: m.done.length, t: "green", I: CheckCircle2 },
      ].map((k) => <article key={k.l} className={`cc-kpi ${k.t}`}><span className="cc-kpi-ico"><k.I size={18} /></span><div><small>{k.l}</small><b>{L ? <InlineNumberLoader label="جارٍ التحميل" /> : num(k.v)}</b></div>{k.spark && <Spark data={k.spark} />}</article>)}
    </section>

    <div className="cc-grid">
      <section className="cc-card cc-feed">
        <header><div><h3>أحدث البلاغات</h3><p>اضغط على أي بلاغ لفتح تفاصيله</p></div><Link href="/reports" className="text-link">كل البلاغات <ArrowUpLeft size={15} /></Link></header>
        <div className="cc-list">
          {reports.slice(0, 6).map((r) => <Link key={r.id} href={`/reports?reference=${r.reference}`} className="cc-item">
            <span className={`cc-dot ${r.status}`} />
            <div className="cc-item-main"><b>{r.title}</b><small>{r.city || r.governorate || "—"} · {r.user_name || r.user_phone || "—"}</small></div>
            <div className="cc-item-side"><span className={`status-pill ${r.status}`}><i />{statusLabel[r.status]}</span><small>{r.created_at}</small></div>
          </Link>)}
          {L ? <div className="empty-state">بنحمّل البلاغات...</div> : !reports.length && <div className="empty-state">لسه مفيش بلاغات.</div>}
        </div>
      </section>

      <aside className="cc-side">
        <section className="cc-card cc-attn">
          <header><h3><AlertTriangle size={17} /> محتاجة تدخل</h3><span className="cc-count">{num(m.late.length)}</span></header>
          {m.late.length ? m.late.slice(0, 3).map((r) => <Link key={r.id} href={`/reports?reference=${r.reference}`} className="cc-late"><b>{r.title}</b><small>{r.city || "—"} · {r.created_at}</small></Link>) : <p className="cc-muted">مفيش بلاغات متأخرة. كل حاجة تحت السيطرة ✅</p>}
        </section>

        <section className="cc-card">
          <header><h3>توزيع الحالات</h3></header>
          <div className="cc-bar" aria-hidden="true"><i className="pending" style={{ width: `${seg(m.pending.length)}%` }} /><i className="in_progress" style={{ width: `${seg(m.prog.length)}%` }} /><i className="resolved" style={{ width: `${seg(m.done.length)}%` }} /><i className="rejected" style={{ width: `${seg(m.rej.length)}%` }} /></div>
          <ul className="cc-legend">{([["pending", m.pending.length], ["in_progress", m.prog.length], ["resolved", m.done.length], ["rejected", m.rej.length]] as const).map(([k, n]) => <li key={k}><i className={k} />{statusLabel[k]}<b>{num(n)}</b></li>)}</ul>
        </section>

        <section className="cc-card">
          <header><h3><MapPin size={16} /> أكتر المناطق بلاغات</h3></header>
          {m.areas.length ? m.areas.map(([a, n]) => <div key={a} className="cc-area"><span>{a}</span><div><i style={{ width: `${(n / m.areas[0][1]) * 100}%` }} /></div><b>{num(n)}</b></div>) : <p className="cc-muted">مفيش بيانات مناطق لسه.</p>}
          <p className="cc-foot"><Users size={14} /> {loading ? "…" : num(users.length)} مواطن مسجّل</p>
        </section>
      </aside>
    </div>
  </div>;
}

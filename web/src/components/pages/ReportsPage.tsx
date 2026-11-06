"use client";
import { useMemo, useState } from "react";
import Image from "next/image";
import { Download, Search, Eye } from "lucide-react";
import { adminRequest, ReportRow, reportLocationLabel, statusLabel } from "@/lib/admin-api";
import { useLiveReports } from "@/lib/use-live-reports";
import { InlineNumberLoader } from "@/components/InlineNumberLoader";
import { downloadExcel } from "@/lib/excel-export";

export default function ReportsPage() {
  const { reports: rows, setReports: setRows, loading, error, setError } = useLiveReports();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [detail, setDetail] = useState<ReportRow | null>(null);
  async function update(id: number, status: ReportRow["status"]) {
    try {
      await adminRequest(`/admin/reports/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setRows((current) => current.map((report) => report.id === id ? { ...report, status } : report));
      setDetail((current) => current?.id === id ? { ...current, status } : current);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تحديث الحالة."); }
  }
  async function openDetail(report: ReportRow) {
    setDetail(report);
    try {
      const result = await adminRequest<{ data: { report: ReportRow } }>(`/admin/reports/${report.id}`);
      setDetail(result.data.report);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تحميل تفاصيل البلاغ."); }
  }
  const filtered = useMemo(() => rows.filter((report) => {
    const text = `${report.reference} ${report.title} ${report.city} ${report.location} ${report.user_name ?? ""} ${report.user_phone ?? ""}`.toLowerCase();
    return (filter === "all" || report.status === filter) && text.includes(q.trim().toLowerCase());
  }), [rows, filter, q]);
  function exportExcel() { downloadExcel("tareeqak-reports", "تقرير البلاغات", ["رقم البلاغ", "العنوان", "المستخدم", "المنطقة", "موقع المشكلة", "الحالة"], filtered.map((r) => [r.reference,r.title,r.user_name ?? r.user_phone ?? "",r.city || r.governorate,reportLocationLabel(r.location),statusLabel[r.status]])); }
  return <section className="panel">
    {error && <p className="error-message" role="alert">{error}</p>}
    <div className="toolbar"><div className="search-box"><Search size={17} /><input placeholder="ابحث برقم البلاغ أو العنوان أو المنطقة..." value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">كل الحالات</option><option value="pending">جديد</option><option value="in_progress">قيد المعالجة</option><option value="resolved">تم الحل</option><option value="rejected">مرفوض</option></select>
      <button className="btn btn-light" onClick={exportExcel} disabled={!filtered.length}><Download size={16} /> تصدير Excel</button>
    </div>
    <div className="results-note">عدد النتائج: <b>{loading ? <InlineNumberLoader label="جارٍ تحميل عدد النتائج" /> : filtered.length}</b><small className="live-update-note">يتحدث تلقائيًا كل 10 ثوانٍ</small></div>
    <div className="table-wrap"><table><thead><tr><th>رقم البلاغ</th><th>العنوان والتصنيف</th><th>المستخدم</th><th>المنطقة / موقع المشكلة</th><th>الحالة</th><th>تغيير الحالة</th><th>التفاصيل</th></tr></thead>
        <tbody>{filtered.map((r) => <tr key={r.id}><td><span className="ref-code">{r.reference}</span><small className="table-date">{r.created_at}</small></td><td><b className="table-title">{r.title}</b><small className="table-date">{r.category}</small></td><td>{r.user_name || r.user_phone || "—"}</td><td><b>{r.city || r.governorate || "—"}</b><small className="table-date">{reportLocationLabel(r.location)}</small></td><td><span className={`status-pill ${r.status}`}><i />{statusLabel[r.status]}</span></td><td><select className="status-select" value={r.status} onChange={(e) => void update(r.id, e.target.value as ReportRow["status"])}>{Object.entries(statusLabel).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></td><td><button className="btn btn-small btn-light" onClick={() => void openDetail(r)}><Eye size={14} /> عرض</button></td></tr>)}</tbody></table>
      {loading ? <div className="empty-state">جارٍ تحميل البلاغات...</div> : !filtered.length && <div className="empty-state">لا توجد بلاغات مسجلة تطابق البحث.</div>}
    </div>
    {detail && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setDetail(null)}><section className="confirm-modal report-detail modal-panel" role="dialog" aria-modal="true" aria-labelledby="report-detail-title" onMouseDown={(event) => event.stopPropagation()}>
      <button type="button" className="modal-x" aria-label="إغلاق تفاصيل البلاغ" onClick={() => setDetail(null)}>×</button>
      <header className="modal-heading report-modal-heading"><span className="modal-heading-icon report"><Eye size={20} /></span><div><span className="ref-code">{detail.reference}</span><h2 id="report-detail-title">{detail.title}</h2><span className={`status-pill ${detail.status}`}><i />{statusLabel[detail.status]}</span></div></header>
      <section className="modal-section"><h3 className="modal-section-title">بيانات البلاغ</h3><dl className="report-detail-facts"><div><dt>التصنيف</dt><dd>{detail.category || "—"}</dd></div><div><dt>المنطقة</dt><dd>{[detail.city,detail.governorate].filter(Boolean).join("، ") || "—"}</dd></div><div><dt>موقع المشكلة</dt><dd>{reportLocationLabel(detail.location)}</dd></div><div><dt>مقدم البلاغ</dt><dd>{detail.user_name || detail.user_phone || "—"}</dd></div><div className="wide-field"><dt>تاريخ الإرسال</dt><dd>{detail.created_at}</dd></div></dl></section>
      <section className="modal-section report-description-section"><h3 className="modal-section-title">وصف البلاغ</h3><p>{detail.description || "لا يوجد وصف إضافي."}</p></section>
      {detail.image_base64 && <section className="modal-section report-image-section"><h3 className="modal-section-title">الصورة المرفقة</h3><Image src={`data:${detail.image_type || "image/jpeg"};base64,${detail.image_base64}`} alt="صورة مرفقة بالبلاغ" width={640} height={360} unoptimized /></section>}
      <footer className="modal-actions report-detail-actions"><label>حالة البلاغ<select value={detail.status} onChange={(event) => void update(detail.id, event.target.value as ReportRow["status"])}>{Object.entries(statusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><button type="button" className="btn btn-light" onClick={() => setDetail(null)}>إغلاق</button></footer>
    </section></div>}
  </section>;
}


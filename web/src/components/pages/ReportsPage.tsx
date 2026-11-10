"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Download, Search, Eye, LayoutGrid, Rows3 } from "lucide-react";
import { adminRequest, ReportRow, reportLocationLabel, statusLabel } from "@/lib/admin-api";
import { useLiveReports } from "@/lib/use-live-reports";
import { InlineNumberLoader } from "@/components/InlineNumberLoader";
import { downloadExcel } from "@/lib/excel-export";

export default function ReportsPage() {
  const { reports: rows, setReports: setRows, loading, error, setError } = useLiveReports();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState(() => { if (typeof window === "undefined") return "all"; const v = new URLSearchParams(window.location.search).get("view"); return v && ["pending","in_progress","resolved","rejected"].includes(v) ? v : "all"; });
  const [view, setView] = useState<"board" | "table">("board");
  const [detail, setDetail] = useState<ReportRow | null>(null);
  const openedReference = useRef("");
  async function update(id: number, status: ReportRow["status"]) {
    try {
      await adminRequest(`/admin/reports/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setRows((current) => current.map((report) => report.id === id ? { ...report, status } : report));
      setDetail((current) => current?.id === id ? { ...current, status } : current);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ما قدرناش نحدّث حالة البلاغ."); }
  }
  const openDetail = useCallback(async (report: ReportRow) => {
    setDetail(report);
    try {
      const result = await adminRequest<{ data: { report: ReportRow } }>(`/admin/reports/${report.id}`);
      setDetail(result.data.report);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ما قدرناش نحمّل تفاصيل البلاغ."); }
  }, [setError]);
  useEffect(() => {
    const reference = new URLSearchParams(window.location.search).get("reference") ?? "";
    if (!reference || openedReference.current === reference) return;
    const report = rows.find((item) => item.reference === reference);
    if (!report) return;
    openedReference.current = reference;
    window.history.replaceState(null, "", window.location.pathname);
    void openDetail(report);
  }, [rows, openDetail]);
  const filtered = useMemo(() => rows.filter((report) => {
    const text = `${report.reference} ${report.title} ${report.city} ${report.location} ${report.user_name ?? ""} ${report.user_phone ?? ""}`.toLowerCase();
    return (filter === "all" || report.status === filter) && text.includes(q.trim().toLowerCase());
  }), [rows, filter, q]);
  function exportExcel() { downloadExcel("tareeqak-reports", "تقرير البلاغات", ["رقم البلاغ", "العنوان", "المستخدم", "المنطقة", "موقع المشكلة", "الحالة"], filtered.map((r) => [r.reference,r.title,r.user_name ?? r.user_phone ?? "",r.city || r.governorate,reportLocationLabel(r.location),statusLabel[r.status]])); }
  return <section className="panel">
    {error && <p className="error-message" role="alert">{error}</p>}
    <div className="toolbar"><div className="search-box"><Search size={17} /><input placeholder="اكتب رقم البلاغ أو عنوانه أو المنطقة" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">كل الحالات</option><option value="pending">جديد</option><option value="in_progress">قيد المعالجة</option><option value="resolved">تم الحل</option><option value="rejected">مرفوض</option></select>
      <div className="view-toggle" role="group" aria-label="طريقة العرض"><button type="button" className={view === "board" ? "on" : ""} onClick={() => setView("board")}><LayoutGrid size={15} /> لوحة</button><button type="button" className={view === "table" ? "on" : ""} onClick={() => setView("table")}><Rows3 size={15} /> جدول</button></div>
      <button className="btn btn-light" onClick={exportExcel} disabled={!filtered.length}><Download size={16} /> تصدير Excel</button>
    </div>
    <div className="results-note">البلاغات: <b>{loading ? <InlineNumberLoader label="جارٍ تحميل عدد النتائج" /> : filtered.length}</b><small className="live-update-note">تتحدث القائمة تلقائيًا كل 5 ثوانٍ</small></div>
    {view === "board" && <div className="board">{(["pending","in_progress","resolved","rejected"] as const).map((st) => { const col = filtered.filter((r) => r.status === st); const order = ["pending","in_progress","resolved"] as const; const idx = order.indexOf(st as never); return <section key={st} className={`board-col ${st}`}><header><span><i />{statusLabel[st]}</span><b>{col.length}</b></header><div className="board-cards">{col.map((r) => <article key={r.id} className="board-card" onClick={() => void openDetail(r)}><div className="board-card-top"><span className="ref-code">{r.reference}</span><small>{r.created_at}</small></div><h4>{r.title}</h4><p>{r.city || r.governorate || "—"} · {reportLocationLabel(r.location)}</p><footer><span>{r.user_name || r.user_phone || "—"}</span>{idx >= 0 && idx < 2 && <button type="button" className="board-move" onClick={(e) => { e.stopPropagation(); void update(r.id, order[idx + 1]); }}>انقل إلى «{statusLabel[order[idx + 1]]}» ←</button>}</footer></article>)}{!col.length && !loading && <div className="board-empty">فاضي</div>}</div></section>; })}</div>}
    {view === "table" && <div className="table-wrap"><table><thead><tr><th>رقم البلاغ</th><th>العنوان والتصنيف</th><th>المستخدم</th><th>المنطقة / موقع المشكلة</th><th>الحالة</th><th>تغيير الحالة</th><th>التفاصيل</th></tr></thead>
        <tbody>{filtered.map((r) => <tr key={r.id}><td><span className="ref-code">{r.reference}</span><small className="table-date">{r.created_at}</small></td><td><b className="table-title">{r.title}</b><small className="table-date">{r.category}</small></td><td>{r.user_name || r.user_phone || "—"}</td><td><b>{r.city || r.governorate || "—"}</b><small className="table-date">{reportLocationLabel(r.location)}</small></td><td><span className={`status-pill ${r.status}`}><i />{statusLabel[r.status]}</span></td><td><select className="status-select" value={r.status} onChange={(e) => void update(r.id, e.target.value as ReportRow["status"])}>{Object.entries(statusLabel).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></td><td><button className="btn btn-small btn-light" onClick={() => void openDetail(r)}><Eye size={14} /> عرض</button></td></tr>)}</tbody></table>
      {loading ? <div className="empty-state">بنحمّل البلاغات...</div> : !filtered.length && <div className="empty-state">مفيش بلاغات مطابقة للبحث.</div>}
    </div>}
    {detail && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setDetail(null)}><section className="confirm-modal report-detail modal-panel" role="dialog" aria-modal="true" aria-labelledby="report-detail-title" onMouseDown={(event) => event.stopPropagation()}>
      <button type="button" className="modal-x" aria-label="إغلاق تفاصيل البلاغ" onClick={() => setDetail(null)}>×</button>
      <header className="modal-heading report-modal-heading"><span className="modal-heading-icon report"><Eye size={20} /></span><div><span className="ref-code">{detail.reference}</span><h2 id="report-detail-title">{detail.title}</h2><span className={`status-pill ${detail.status}`}><i />{statusLabel[detail.status]}</span></div></header>
      <section className="modal-section"><h3 className="modal-section-title">تفاصيل البلاغ</h3><dl className="report-detail-facts"><div><dt>نوع المشكلة</dt><dd>{detail.category || "—"}</dd></div><div><dt>المحافظة والمنطقة</dt><dd>{[detail.city,detail.governorate].filter(Boolean).join("، ") || "—"}</dd></div><div><dt>الموقع</dt><dd>{reportLocationLabel(detail.location)}</dd></div><div><dt>مقدم البلاغ</dt><dd>{detail.user_name || detail.user_phone || "—"}</dd></div><div className="wide-field"><dt>تاريخ البلاغ</dt><dd>{detail.created_at}</dd></div></dl></section>
      <section className="modal-section report-description-section"><h3 className="modal-section-title">وصف البلاغ</h3><p>{detail.description || "لا يوجد وصف إضافي."}</p></section>
      {detail.image_base64 && <section className="modal-section report-image-section"><h3 className="modal-section-title">الصورة المرفقة</h3><Image src={`data:${detail.image_type || "image/jpeg"};base64,${detail.image_base64}`} alt="صورة مرفقة بالبلاغ" width={640} height={360} unoptimized /></section>}
      <footer className="modal-actions report-detail-actions"><label className="report-status-control"><span>حالة البلاغ</span><select value={detail.status} onChange={(event) => void update(detail.id, event.target.value as ReportRow["status"])}>{Object.entries(statusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><button type="button" className="btn btn-light" onClick={() => setDetail(null)}>إغلاق</button></footer>
    </section></div>}
  </section>;
}


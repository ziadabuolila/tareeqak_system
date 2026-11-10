"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, ExternalLink, Eye, LocateFixed, MapPin, MapPinned, Search } from "lucide-react";
import Image from "next/image";
import { adminRequest, ReportRow, reportLocationLabel, statusLabel } from "@/lib/admin-api";
import { useLiveReports } from "@/lib/use-live-reports";
import { InlineNumberLoader } from "@/components/InlineNumberLoader";

type Coordinates = { latitude: number; longitude: number };
type LeafletMarker = { bindPopup(content: HTMLElement): LeafletMarker; addTo(map: LeafletMap): LeafletMarker; setLatLng(position: [number, number]): LeafletMarker; setIcon(icon: unknown): LeafletMarker; openPopup(): LeafletMarker; remove(): void; on(event: "click", handler: () => void): LeafletMarker };
type LeafletMap = { setView(position: [number, number], zoom: number): LeafletMap; fitBounds(bounds: [number, number][], options?: { padding?: [number, number]; maxZoom?: number }): LeafletMap; invalidateSize(): LeafletMap; remove(): void };
type LeafletApi = {
  map(element: HTMLElement, options?: { zoomControl?: boolean; scrollWheelZoom?: boolean }): LeafletMap;
  tileLayer(url: string, options: Record<string, unknown>): { addTo(map: LeafletMap): void };
  divIcon(options: Record<string, unknown>): unknown;
  marker(position: [number, number], options?: Record<string, unknown>): LeafletMarker;
};
declare global { interface Window { L?: LeafletApi } }

type LocatedReport = ReportRow & { coordinates: Coordinates };
const statusColor: Record<ReportRow["status"], string> = { pending: "#e9a23b", in_progress: "#4788c7", resolved: "#3a9b69", rejected: "#d45f5f" };

function getCoordinates(location: string): Coordinates | null {
  const value = location.trim();
  const embedded = value.match(/GPS\s*:\s*(-?\d{1,2}(?:\.\d+)?)\s*[,،]\s*(-?\d{1,3}(?:\.\d+)?)/i);
  const match = embedded ?? value.match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,،]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

function safeText(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character] ?? character);
}

function loadLeaflet(): Promise<LeafletApi> {
  if (window.L) return Promise.resolve(window.L);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-tareeqak-leaflet]');
    if (existing) {
      existing.addEventListener("load", () => window.L ? resolve(window.L) : reject(new Error("تعذر تحميل الخريطة.")), { once: true });
      existing.addEventListener("error", () => reject(new Error("تعذر الاتصال بمصدر الخريطة.")), { once: true });
      return;
    }
    if (!document.querySelector('link[data-tareeqak-leaflet]')) {
      const stylesheet = document.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      stylesheet.dataset.tareeqakLeaflet = "true";
      document.head.appendChild(stylesheet);
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.dataset.tareeqakLeaflet = "true";
    script.onload = () => window.L ? resolve(window.L) : reject(new Error("تعذر تشغيل الخريطة."));
    script.onerror = () => reject(new Error("تعذر الاتصال بمصدر الخريطة."));
    document.head.appendChild(script);
  });
}

export default function MapPage() {
  const { reports: rows, setReports, loading, error: reportsError, setError } = useLiveReports();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [mapError, setMapError] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<ReportRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<LeafletMap | null>(null);
  const markers = useRef(new Map<number, LeafletMarker>());
  const hasAutoFitted = useRef(false);

  const located = useMemo<LocatedReport[]>(() => rows.flatMap((report) => {
    const coordinates = getCoordinates(report.location);
    return coordinates ? [{ ...report, coordinates }] : [];
  }), [rows]);
  const filtered = useMemo(() => rows.filter((report) => {
    const text = `${report.reference} ${report.title} ${report.category} ${report.city} ${report.governorate} ${report.location}`.toLowerCase();
    return (statusFilter === "all" || report.status === statusFilter) && text.includes(query.trim().toLowerCase());
  }), [rows, statusFilter, query]);
  const visibleLocated = useMemo(() => filtered.flatMap((report) => {
    const coordinates = getCoordinates(report.location);
    return coordinates ? [{ ...report, coordinates }] : [];
  }), [filtered]);
  const pinnedCount = rows.filter((report) => getCoordinates(report.location)).length;

  const openReportDetails = useCallback(async (report: ReportRow) => {
    setDetail(report);
    setDetailLoading(true);
    try {
      const result = await adminRequest<{ data: { report: ReportRow } }>(`/admin/reports/${report.id}`);
      setDetail(result.data.report);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ما قدرناش نحمّل تفاصيل البلاغ.");
    } finally { setDetailLoading(false); }
  }, [setError]);

  const detailId = detail?.id;
  useEffect(() => {
    if (detailId == null) return;
    const latest = rows.find((report) => report.id === detailId);
    if (latest) setDetail((current) => current?.id === latest.id ? { ...current, ...latest, image_base64: current.image_base64, image_type: current.image_type } : current);
  }, [rows, detailId]);

  async function updateReportStatus(report: ReportRow, status: ReportRow["status"]) {
    try {
      await adminRequest(`/admin/reports/${report.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setReports((current) => current.map((item) => item.id === report.id ? { ...item, status } : item));
      setDetail((current) => current?.id === report.id ? { ...current, status } : current);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ما قدرناش نحدّث حالة البلاغ."); }
  }

  useEffect(() => {
    let active = true;
    const markerStore = markers.current;
    loadLeaflet().then((leaflet) => {
      if (!active || !mapElement.current || mapInstance.current) return;
      const map = leaflet.map(mapElement.current, { zoomControl: false, scrollWheelZoom: true }).setView([26.8, 30.8], 6);
      leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
      mapInstance.current = map;
      window.setTimeout(() => map.invalidateSize(), 80);
    }).catch((error: unknown) => { if (active) setMapError(error instanceof Error ? error.message : "تعذر تحميل الخريطة."); });
    return () => { active = false; mapInstance.current?.remove(); mapInstance.current = null; markerStore.clear(); };
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    const leaflet = window.L;
    if (!map || !leaflet) return;
    const visibleIds = new Set(visibleLocated.map((report) => report.id));
    for (const [id, marker] of markers.current) {
      if (!visibleIds.has(id)) { marker.remove(); markers.current.delete(id); }
    }
    for (const report of visibleLocated) {
      const position: [number, number] = [report.coordinates.latitude, report.coordinates.longitude];
      const icon = leaflet.divIcon({ className: "report-map-marker-wrap", html: `<span class="report-map-marker" style="--marker-color:${statusColor[report.status]}"><span></span></span>`, iconSize: [34, 42], iconAnchor: [17, 39] });
      const marker = markers.current.get(report.id) ?? leaflet.marker(position, {
        icon,
      }).addTo(map).on("click", () => { setSelected(report.id); void openReportDetails(report); });
      marker.setLatLng(position);
      marker.setIcon(icon);
      const popup = document.createElement("div");
      popup.className = "report-map-popup";
      popup.innerHTML = `<strong>${safeText(report.title)}</strong><span>${safeText(report.reference)} · ${safeText(report.category)}</span><span>${safeText(reportLocationLabel(report.location))}</span><span>${safeText(statusLabel[report.status])}</span>`;
      marker.bindPopup(popup);
      markers.current.set(report.id, marker);
    }
    if (!hasAutoFitted.current && visibleLocated.length === 1) {
      map.setView([visibleLocated[0].coordinates.latitude, visibleLocated[0].coordinates.longitude], 14);
      hasAutoFitted.current = true;
    } else if (!hasAutoFitted.current && visibleLocated.length > 1) {
      map.fitBounds(visibleLocated.map((report) => [report.coordinates.latitude, report.coordinates.longitude]), { padding: [42, 42], maxZoom: 14 });
      hasAutoFitted.current = true;
    }
  }, [visibleLocated, openReportDetails]);

  function focusReport(report: ReportRow) {
    setSelected(report.id);
    const coordinates = getCoordinates(report.location);
    if (!coordinates || !mapInstance.current) return;
    mapInstance.current.setView([coordinates.latitude, coordinates.longitude], 16);
    const marker = markers.current.get(report.id);
    if (marker) {
      const popup = document.createElement("div");
      popup.className = "report-map-popup";
      popup.innerHTML = `<strong>${safeText(report.title)}</strong><span>${safeText(report.reference)} · ${safeText(report.category)}</span><span>${safeText(reportLocationLabel(report.location))}</span><span>${safeText(statusLabel[report.status])}</span>`;
      marker.bindPopup(popup).openPopup();
    }
  }

  return <div className="map-page">
    <section className="map-summary-row" aria-label="ملخص الخريطة">
      <article className="map-summary-card"><span className="map-summary-icon"><MapPinned size={19} /></span><div><small>إجمالي البلاغات</small><b>{loading ? <InlineNumberLoader label="جارٍ تحميل إجمالي البلاغات" /> : rows.length}</b></div></article>
      <article className="map-summary-card"><span className="map-summary-icon mapped"><MapPin size={19} /></span><div><small>بلاغات على الخريطة</small><b>{loading ? <InlineNumberLoader label="جارٍ تحميل البلاغات ذات الإحداثيات" /> : pinnedCount}</b></div></article>
      <article className="map-summary-card"><span className="map-summary-icon waiting"><Activity size={19} /></span><div><small>بانتظار تحديد GPS</small><b>{loading ? <InlineNumberLoader label="جارٍ تحميل البلاغات دون إحداثيات" /> : rows.length - pinnedCount}</b></div></article>
    </section>
    {(mapError || reportsError) && <p className="error-message" role="alert">{mapError || reportsError}</p>}
    <section className="panel map-workspace">
      <div className="panel-head map-workspace-head"><div><h3>خريطة مواقع البلاغات</h3><p>حرّك الخريطة أو كبّرها، واضغط على العلامة لعرض تفاصيل البلاغ.</p></div><span className="map-coverage"><i /> {loading ? <InlineNumberLoader label="جارٍ تحميل عدد المواقع" /> : `${visibleLocated.length} موقع ظاهر`}</span></div>
      <div className="map-layout map-layout-real">
        <div className="map-visual map-visual-real" ref={mapElement} aria-label="خريطة تفاعلية لمواقع البلاغات" role="application">
          {!loading && !located.length && <div className="map-empty-overlay"><span><MapPinned size={23} /></span><b>لسه مفيش مواقع محددة للبلاغات</b><small>لما يتبعت بلاغ بموقعه، هتلاقيه هنا.</small></div>}
          <div className="map-zoom-hint"><LocateFixed size={14} /> عجلة الفأرة للتكبير والتحريك للسحب</div>
        </div>
        <aside className="map-side map-report-side">
          <div className="map-side-heading"><div><h3>قائمة البلاغات</h3><p>اختار بلاغًا للانتقال لموقعه.</p></div><span>{loading ? <InlineNumberLoader label="جارٍ تحميل عدد البلاغات" /> : filtered.length}</span></div>
          <div className="map-side-filters"><label className="search-box"><Search size={16} /><input aria-label="ابحث في البلاغات" placeholder="رقم البلاغ، العنوان، المنطقة..." value={query} onChange={(event) => setQuery(event.target.value)} /></label><select aria-label="تصفية حسب الحالة" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">كل الحالات</option>{Object.entries(statusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
          <div className="map-status-legend"><span><i className="pending-dot" /> جديد</span><span><i className="progress-dot" /> قيد المعالجة</span><span><i className="resolved-dot" /> تم الحل</span><span><i className="rejected-dot" /> مرفوض</span></div>
          <div className="map-report-list">{loading ? <div className="empty-state">جارٍ تحميل البلاغات...</div> : filtered.length ? filtered.map((report) => {
            const hasCoordinates = Boolean(getCoordinates(report.location));
            return <button type="button" className={`map-list-report ${selected === report.id ? "selected" : ""}`} key={report.id} onClick={() => { focusReport(report); void openReportDetails(report); }}><span className={`map-list-pin ${report.status}`}><MapPin size={16} /></span><span className="map-list-copy"><b>{report.title}</b><small>{report.reference} · {report.city || report.governorate || (hasCoordinates ? "موقع GPS" : "موقع غير محدد")}</small><small>{reportLocationLabel(report.location)}</small></span><span className={`map-list-state ${report.status}`}>{statusLabel[report.status]}</span></button>;
          }) : <div className="empty-state">مفيش بلاغات مطابقة للبحث.</div>}</div>
          <div className="map-side-footnote">{loading ? <InlineNumberLoader label="جارٍ تحميل المواقع" /> : rows.length - pinnedCount ? `${rows.length - pinnedCount} بلاغ من غير إحداثيات؛ هتظهر مواقعها على الخريطة لما تتحدد من التطبيق.` : "مواقع كل البلاغات المسجلة ظاهرة على الخريطة."}</div>
        </aside>
      </div>
    </section>
    {detail && <div className="modal-backdrop map-report-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setDetail(null)}><section className="confirm-modal report-detail map-report-detail modal-panel" role="dialog" aria-modal="true" aria-labelledby="map-report-detail-title" onMouseDown={(event) => event.stopPropagation()}>
      <button type="button" className="modal-x" aria-label="إغلاق تفاصيل البلاغ" onClick={() => setDetail(null)}>×</button>
      <header className="modal-heading report-modal-heading"><span className="modal-heading-icon report"><Eye size={20} /></span><div><span className="ref-code">{detail.reference}</span><h2 id="map-report-detail-title">{detail.title}</h2><span className={`status-pill ${detail.status}`}><i />{statusLabel[detail.status]}</span></div></header>
      {detailLoading && <div className="map-detail-loading" role="status">بنحمّل باقي تفاصيل البلاغ...</div>}
      <section className="modal-section"><h3 className="modal-section-title">تفاصيل البلاغ</h3><dl className="report-detail-facts"><div><dt>نوع المشكلة</dt><dd>{detail.category || "—"}</dd></div><div><dt>المحافظة والمنطقة</dt><dd>{[detail.city, detail.governorate].filter(Boolean).join("، ") || "—"}</dd></div><div><dt>الموقع</dt><dd>{reportLocationLabel(detail.location)}</dd></div><div><dt>مقدم البلاغ</dt><dd>{detail.user_name || detail.user_phone || "—"}</dd></div><div className="wide-field"><dt>تاريخ البلاغ</dt><dd>{detail.created_at || "—"}</dd></div></dl></section>
      <section className="modal-section report-description-section"><h3 className="modal-section-title">وصف البلاغ</h3><p>{detail.description || "لا يوجد وصف إضافي."}</p></section>
      {detail.image_base64 && <section className="modal-section report-image-section"><h3 className="modal-section-title">الصورة المرفقة</h3><Image src={`data:${detail.image_type || "image/jpeg"};base64,${detail.image_base64}`} alt="صورة مرفقة بالبلاغ" width={640} height={360} unoptimized /></section>}
      <footer className="modal-actions report-detail-actions map-report-detail-actions"><label className="report-status-control"><span>حالة البلاغ</span><select value={detail.status} onChange={(event) => void updateReportStatus(detail, event.target.value as ReportRow["status"])}>{Object.entries(statusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>{(() => { const coordinates = getCoordinates(detail.location); return coordinates ? <a className="btn btn-light" href={`https://www.google.com/maps/search/?api=1&query=${coordinates.latitude},${coordinates.longitude}`} target="_blank" rel="noreferrer"><ExternalLink size={15} /> فتح في خرائط Google</a> : null; })()}<button type="button" className="btn btn-light" onClick={() => setDetail(null)}>إغلاق</button></footer>
    </section></div>}
    <p className="map-attribution-note">بيانات الخرائط © OpenStreetMap contributors</p>
  </div>;
}






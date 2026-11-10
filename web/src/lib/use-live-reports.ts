"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { adminRequest, ReportRow } from "@/lib/admin-api";
import { useLiveRefresh } from "@/lib/live-refresh";

export function useLiveReports() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const result = await adminRequest<{ data: { reports: ReportRow[] } }>("/admin/reports");
      setReports(result.data.reports);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحميل البلاغات.");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const refreshWhenVisible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);
    return () => {
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
    };
  }, [refresh]);
  useLiveRefresh(refresh);

  return { reports, setReports, loading, error, setError, refresh };
}

"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, MapPinned, WifiOff } from "lucide-react";

const HEALTH_ENDPOINT = "/api/citizen/catalog?kind=healthcheck";
const RETRY_INTERVAL_MS = 5000;

export default function ServiceAvailabilityGuard({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let active = true;
    let requestInFlight = false;

    const check = async () => {
      if (!active || requestInFlight) return;
      requestInFlight = true;
      try {
        const response = await fetch(HEALTH_ENDPOINT, { cache: "no-store", headers: { Accept: "application/json" } });
        const result = await response.json().catch(() => null) as { status?: boolean } | null;
        if (active) setAvailable(response.ok && result?.status === true);
      } catch {
        if (active) setAvailable(false);
      } finally {
        requestInFlight = false;
        if (active) setChecking(false);
      }
    };

    void check();
    const interval = window.setInterval(() => {
      if (!document.hidden) void check();
    }, RETRY_INTERVAL_MS);
    const checkOnReturn = () => {
      if (document.visibilityState === "visible") void check();
    };
    window.addEventListener("online", checkOnReturn);
    document.addEventListener("visibilitychange", checkOnReturn);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("online", checkOnReturn);
      document.removeEventListener("visibilitychange", checkOnReturn);
    };
  }, []);

  return (
    <>
      {children}
      {(checking || !available) && (
        <div className="service-outage-overlay" role="alertdialog" aria-live="assertive" aria-modal="true" aria-labelledby="service-outage-title">
          <section className="service-outage-card">
            <span className="service-outage-brand"><MapPinned size={19} /> طريقك</span>
            <span className="service-outage-icon">{checking ? <LoaderCircle size={34} /> : <WifiOff size={34} />}</span>
            <h1 id="service-outage-title">{checking ? "جارٍ الاتصال بالنظام" : "النظام غير متاح حاليًا"}</h1>
            <p>{checking ? "بنتأكد من اتصال الخدمة وقاعدة البيانات." : "فيه عطل مؤقت في الاتصال بالخدمة. هنحاول تاني تلقائيًا."}</p>
            <div className="service-outage-progress" aria-label="جارٍ إعادة الاتصال"><i /></div>
            <small>سيتم فتح النظام تلقائيًا عند عودة الخدمة</small>
          </section>
        </div>
      )}
    </>
  );
}

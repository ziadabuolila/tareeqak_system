"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, X } from "lucide-react";

type LiveChange = { id: string; page: string; description: string; exiting?: boolean };

export default function LiveChangeNotifications() {
  const [notices, setNotices] = useState<LiveChange[]>([]);
  const timers = useRef(new Map<string, number>());
  const removalTimers = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    setNotices((current) => current.map((item) => item.id === id ? { ...item, exiting: true } : item));
    const previousRemoval = removalTimers.current.get(id);
    if (previousRemoval) window.clearTimeout(previousRemoval);
    const removalTimer = window.setTimeout(() => {
      setNotices((current) => current.filter((item) => item.id !== id));
      removalTimers.current.delete(id);
    }, 340);
    removalTimers.current.set(id, removalTimer);
  }, []);

  useEffect(() => {
    const timerMap = timers.current;
    const removalTimerMap = removalTimers.current;
    const receive = (event: Event) => {
      const notice = (event as CustomEvent<LiveChange>).detail;
      if (!notice?.id || !notice.page || !notice.description) return;
      const previousTimer = timerMap.get(notice.id);
      if (previousTimer) window.clearTimeout(previousTimer);
      const previousRemovalTimer = removalTimerMap.get(notice.id);
      if (previousRemovalTimer) window.clearTimeout(previousRemovalTimer);
      setNotices((current) => [...current.filter((item) => item.id !== notice.id), notice].slice(-4));
      const timer = window.setTimeout(() => {
        dismiss(notice.id);
      }, 8000);
      timerMap.set(notice.id, timer);
    };

    window.addEventListener("tareeqak:live-change", receive);
    return () => {
      window.removeEventListener("tareeqak:live-change", receive);
      timerMap.forEach((timer) => window.clearTimeout(timer));
      removalTimerMap.forEach((timer) => window.clearTimeout(timer));
    };
  }, [dismiss]);

  return (
    <aside className="live-change-stack" aria-label="تحديثات النظام المباشرة" aria-live="polite">
      {notices.map((notice) => (
        <article className={`live-change-card${notice.exiting ? " is-exiting" : ""}`} key={notice.id}>
          <span className="live-change-icon"><Activity size={19} /></span>
          <div className="live-change-copy">
            <span className="live-change-eyebrow">تحديث مباشر <i /> {notice.page}</span>
            <p>{notice.description}</p>
          </div>
          <button type="button" className="live-change-close" aria-label="إغلاق التنبيه" onClick={() => dismiss(notice.id)}>
            <X size={16} />
          </button>
          <span className="live-change-progress" />
        </article>
      ))}
    </aside>
  );
}

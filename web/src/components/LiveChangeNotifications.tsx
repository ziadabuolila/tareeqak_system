"use client";

import { useEffect, useState } from "react";
import { Activity, X } from "lucide-react";

type LiveChange = { id: string; page: string; description: string };

export default function LiveChangeNotifications() {
  const [notices, setNotices] = useState<LiveChange[]>([]);

  useEffect(() => {
    const timers = new Map<string, number>();
    const receive = (event: Event) => {
      const notice = (event as CustomEvent<LiveChange>).detail;
      if (!notice?.id || !notice.page || !notice.description) return;
      setNotices((current) => [...current.filter((item) => item.id !== notice.id), notice].slice(-4));
      const timer = window.setTimeout(() => {
        setNotices((current) => current.filter((item) => item.id !== notice.id));
        timers.delete(notice.id);
      }, 8000);
      timers.set(notice.id, timer);
    };

    window.addEventListener("tareeqak:live-change", receive);
    return () => {
      window.removeEventListener("tareeqak:live-change", receive);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  function dismiss(id: string) {
    setNotices((current) => current.filter((notice) => notice.id !== id));
  }

  return (
    <aside className="live-change-stack" aria-label="تحديثات النظام المباشرة" aria-live="polite">
      {notices.map((notice) => (
        <article className="live-change-card" key={notice.id}>
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

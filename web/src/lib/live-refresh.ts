"use client";

import { useEffect } from "react";

const refreshEvent = "tareeqak:live-refresh";

export function useLiveRefresh(refresh: () => void | Promise<void>) {
  useEffect(() => {
    const listener = () => { if (!document.hidden) void refresh(); };
    window.addEventListener(refreshEvent, listener);
    return () => window.removeEventListener(refreshEvent, listener);
  }, [refresh]);
}

export function LiveRefreshProvider() {
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) window.dispatchEvent(new Event(refreshEvent));
    }, 10_000);
    return () => window.clearInterval(timer);
  }, []);
  return null;
}

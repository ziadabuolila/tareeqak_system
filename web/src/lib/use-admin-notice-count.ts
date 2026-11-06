"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

let audioContext: AudioContext | null = null;
let audioReady = false;

function playNoticeSound() {
  if (!audioReady) return;
  try {
    audioContext ??= new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine"; oscillator.frequency.value = 740;
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.11, audioContext.currentTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.22);
    oscillator.connect(gain); gain.connect(audioContext.destination);
    oscillator.start(); oscillator.stop(audioContext.currentTime + 0.23);
  } catch { /* Audio can be unavailable in restricted browser contexts. */ }
}

export function useAdminNoticeCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let latestId: number | null = null;
    let inFlight = false;
    const unlockAudio = () => { audioReady = true; };
    window.addEventListener("pointerdown", unlockAudio, { once: true });
    const refresh = async () => {
      const token = localStorage.getItem("tareeqak_admin_token");
      if (!token || document.hidden || inFlight) return;
      inFlight = true;
      try {
        const response = await fetch("/api/admin/notifications", { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, cache: "no-store" });
        if (!response.ok) return;
        const result = await response.json() as { data?: { notifications?: Array<{ id: number; read: number; title: string; body: string }> } };
        const notifications = result.data?.notifications ?? [];
        setCount(notifications.filter((notice) => !notice.read).length);
        const newestId = notifications[0]?.id ?? null;
        if (latestId !== null && newestId !== null && newestId > latestId) {
          const latest = notifications[0];
          toast(latest.title, { description: latest.body, duration: 5000 });
          playNoticeSound();
        }
        if (newestId !== null) latestId = Math.max(latestId ?? newestId, newestId);
      } catch { /* Leave the latest badge unchanged during temporary network loss. */ }
      finally { inFlight = false; }
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 10_000);
    return () => { window.clearInterval(timer); window.removeEventListener("pointerdown", unlockAudio); };
  }, []);
  return count;
}

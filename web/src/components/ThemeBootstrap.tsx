"use client";

import { useEffect } from "react";

export default function ThemeBootstrap() {
  useEffect(() => {
    const applyTheme = () => {
      document.documentElement.dataset.theme = localStorage.getItem("tareeqak_theme") === "dark" ? "dark" : "light";
    };

    applyTheme();
    const syncTheme = (event: StorageEvent) => {
      if (event.key === "tareeqak_theme") applyTheme();
    };
    window.addEventListener("storage", syncTheme);
    return () => window.removeEventListener("storage", syncTheme);
  }, []);

  return null;
}

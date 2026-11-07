"use client";
import { useEffect, useState } from "react";
import { Check, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import CatalogPage from "@/components/pages/CatalogPage";

type Theme = "light" | "dark";

const themes: Array<{ id: Theme; title: string; description: string }> = [
  { id: "light", title: "الوضع الفاتح", description: "ألوان مشرقة وهادئة للاستخدام نهارًا." },
  { id: "dark", title: "الوضع الداكن", description: "ألوان مريحة للعين في الإضاءة المنخفضة." },
];

export default function SettingsPage() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const savedTheme = localStorage.getItem("tareeqak_theme");
    const initialTheme = savedTheme === "dark" ? "dark" : "light";
    setTheme(initialTheme);
    document.documentElement.dataset.theme = initialTheme;
  }, []);

  function selectTheme(nextTheme: Theme) {
    setTheme(nextTheme);
    localStorage.setItem("tareeqak_theme", nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    toast.success(nextTheme === "dark" ? "تم تفعيل الوضع الداكن" : "تم تفعيل الوضع الفاتح");
  }

  return (
    <>
    <section className="panel appearance-settings" aria-labelledby="appearance-title">
      <div className="appearance-heading">
        <span className="appearance-heading-icon"><Sun size={20} /></span>
        <div>
          <h2 id="appearance-title">المظهر</h2>
          <p>اختار الألوان اللي تريحك. اختيارك بيتحفظ على جهازك ويتطبق على النظام كله.</p>
        </div>
      </div>

      <div className="theme-options" role="group" aria-label="اختيار مظهر النظام">
        {themes.map((option) => {
          const selected = theme === option.id;
          const Icon = option.id === "dark" ? Moon : Sun;
          return (
            <button
              className={`theme-option ${selected ? "selected" : ""}`}
              type="button"
              key={option.id}
              aria-pressed={selected}
              onClick={() => selectTheme(option.id)}
            >
              <span className={`theme-preview theme-preview-${option.id}`} aria-hidden="true">
                <span className="theme-preview-sidebar" />
                <span className="theme-preview-content">
                  <i />
                  <b />
                  <em />
                  <small />
                </span>
              </span>
              <span className="theme-option-details">
                <span className={`theme-option-icon ${option.id}`}><Icon size={18} /></span>
                <span className="theme-option-copy">
                  <strong>{option.title}</strong>
                  <small>{option.description}</small>
                </span>
                <span className="theme-option-check" aria-hidden="true">{selected && <Check size={15} />}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
    <div style={{ marginTop: 18 }}><CatalogPage /></div>
    </>
  );
}

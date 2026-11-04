"use client";
import { useEffect } from "react";

export default function DemoDataCleanup() {
  useEffect(() => {
    for (const key of ["tareeqak_demo_reports", "tareeqak_demo_users", "tareeqak_demo_employees", "tareeqak_demo_settings", "tareeqak_demo_notices"]) {
      localStorage.removeItem(key);
    }
  }, []);
  return null;
}

"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Mail, Save, UserRound } from "lucide-react";
import { adminRequest } from "@/lib/admin-api";
import { useRouter } from "next/navigation";

export default function AccountPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    adminRequest<{data:{user:{name:string;email:string|null}}}>("/admin/account").then((result) => {
      setName(result.data.user.name);
      setEmail(result.data.user.email || "");
    }).catch((cause) => setError(cause instanceof Error ? cause.message : "تعذر تحميل بيانات الحساب."));
  }, []);

  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const result = await adminRequest<{data:{user:{name:string;email:string}}}>("/admin/account", { method: "PATCH", body: JSON.stringify({ name, email }) });
      localStorage.setItem("tareeqak_admin_name", result.data.user.name);
      localStorage.setItem("tareeqak_admin_email", result.data.user.email);
      if (result.data.user.email !== email.trim().toLowerCase()) {
        localStorage.removeItem("tareeqak_admin_token");
        router.replace("/login");
      }
      setName(result.data.user.name); setEmail(result.data.user.email); setError(""); setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر حفظ بيانات الحساب."); }
  }

  return (
    <form className="panel account-form account-card" onSubmit={submit}>
      <div className="account-banner">
        <div className="account-avatar"><UserRound size={27} /></div>
        <div className="account-banner-copy">
          <span className="account-eyebrow">إعدادات الملف الشخصي</span>
          <h2>بيانات حساب المسؤول</h2>
          <p>حدّث الاسم والبريد الإلكتروني الظاهرين في لوحة التحكم.</p>
        </div>
        <span className="account-role"><BadgeCheck size={15} /> مسؤول النظام</span>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}
      <div className="account-fields">
        <label>
          الاسم الظاهر
          <span className="account-input-wrap">
            <UserRound size={17} />
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="اكتب اسمك" autoComplete="name" />
          </span>
          <small>سيظهر هذا الاسم في القائمة الشخصية.</small>
        </label>
        <label>
          البريد الإلكتروني
          <span className="account-input-wrap" dir="ltr">
            <Mail size={17} />
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email" />
          </span>
          <small>استخدم بريدًا إلكترونيًا يمكنك الوصول إليه.</small>
        </label>
      </div>

      <div className="account-form-footer">
        <span className="account-local-note">تُحفظ التعديلات في قاعدة البيانات.</span>
        <div className="account-submit-row">
          {saved && <span className="success-message" role="status">تم حفظ بيانات الحساب.</span>}
          <button className="btn btn-primary"><Save size={16} /> حفظ التغييرات</button>
        </div>
      </div>
    </form>
  );
}

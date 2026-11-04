"use client";

import { useState } from "react";
import { Check, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { adminRequest } from "@/lib/admin-api";

export default function PasswordPage() {
  const [oldPass, setOld] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8) {
      setMsg("يجب أن تتكون كلمة المرور الجديدة من 8 أحرف على الأقل.");
      return;
    }
    if (next !== confirm) {
      setMsg("تأكيد كلمة المرور غير مطابق.");
      return;
    }
    void adminRequest<{message:string}>("/admin/password", { method: "PATCH", body: JSON.stringify({ currentPassword: oldPass, newPassword: next }) })
      .then((result) => { setMsg(result.message || "تم تحديث كلمة المرور."); setOld(""); setNext(""); setConfirm(""); })
      .catch((cause) => setMsg(cause instanceof Error ? cause.message : "تعذر تحديث كلمة المرور."));
  }

  return (
    <form className="panel password-form password-card" onSubmit={submit}>
      <div className="password-card-heading">
        <span className="password-heading-icon"><LockKeyhole size={23} /></span>
        <div>
          <span className="account-eyebrow">الأمان والخصوصية</span>
          <h2>تحديث كلمة المرور</h2>
          <p>اختر كلمة مرور قوية لحماية حسابك ولوحة التحكم.</p>
        </div>
      </div>

      <div className="password-content">
        <div className="password-fields">
          <label>
            كلمة المرور الحالية
            <input type="password" value={oldPass} onChange={(e) => { setOld(e.target.value); setMsg(""); }} required autoComplete="current-password" placeholder="أدخل كلمة المرور الحالية" />
          </label>
          <label>
            كلمة المرور الجديدة
            <input type="password" value={next} onChange={(e) => { setNext(e.target.value); setMsg(""); }} required minLength={8} autoComplete="new-password" placeholder="8 أحرف على الأقل" />
          </label>
          <label>
            تأكيد كلمة المرور الجديدة
            <input type="password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setMsg(""); }} required minLength={8} autoComplete="new-password" placeholder="أعد كتابة كلمة المرور الجديدة" />
          </label>
          {msg && <p className="inline-message" role="status">{msg}</p>}
          <div className="password-submit-row">
            <button className="btn btn-primary"><KeyRound size={16} /> تحديث كلمة المرور</button>
          </div>
        </div>

        <aside className="password-guidance">
          <span className="password-guidance-icon"><ShieldCheck size={20} /></span>
          <h3>نصائح لكلمة مرور آمنة</h3>
          <ul>
            <li><Check size={15} /> استخدم 8 أحرف على الأقل</li>
            <li><Check size={15} /> امزج بين الحروف والأرقام</li>
            <li><Check size={15} /> تجنب المعلومات الشخصية</li>
          </ul>
          <p>لا تشارك كلمة المرور مع أي شخص، واحرص على تحديثها دوريًا.</p>
        </aside>
      </div>
      <div className="password-security-note"><ShieldCheck size={16} /> تُحدّث كلمة المرور بأمان وتُحفظ مشفّرة في قاعدة البيانات.</div>
    </form>
  );
}

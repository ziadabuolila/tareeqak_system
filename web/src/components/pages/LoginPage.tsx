"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Eye, EyeOff, FileCheck2, LoaderCircle, LockKeyhole, Mail, MapPinned, Moon, ShieldCheck, Sun, UsersRound } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";

type AuthUser = { name?: string; email?: string };
type LoginResponse = { data?: { token?: string; user?: AuthUser } };
type PasswordCredentialConstructor = new (credential: { id: string; password: string; name?: string }) => Credential;
type CredentialManagerWithPassword = CredentialsContainer & {
  get(options?: CredentialRequestOptions & { password?: boolean; mediation?: "optional" }): Promise<Credential | null>;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    const manager = navigator.credentials as CredentialManagerWithPassword | undefined;
    if (window.isSecureContext && manager?.get) {
      void manager.get({ password: true, mediation: "optional" }).then((credential) => {
        if (credential && "id" in credential && "password" in credential) {
          setEmail(String(credential.id));
          setPassword(String(credential.password));
          setRemember(true);
        }
      }).catch(() => undefined);
    }
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("tareeqak_theme", nextTheme);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const toastId = toast.loading("جارٍ التحقق من بيانات الدخول...");

    try {
      const result = await apiRequest<LoginResponse>("/admin/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const token = result.data?.token;
      if (!token) throw new Error("تعذّر إكمال تسجيل الدخول. حاول مرة أخرى.");

      localStorage.setItem("tareeqak_admin_token", token);
      localStorage.setItem("tareeqak_admin_last_activity", String(Date.now()));
      if (result.data?.user?.name) localStorage.setItem("tareeqak_admin_name", result.data.user.name);
      if (remember && window.isSecureContext) {
        const PasswordCredential = (window as Window & { PasswordCredential?: PasswordCredentialConstructor }).PasswordCredential;
        const manager = navigator.credentials as CredentialManagerWithPassword | undefined;
        if (PasswordCredential && manager?.store) {
          try {
            const credential = new PasswordCredential({ id: email.trim(), password, name: result.data?.user?.name });
            await manager.store(credential);
          } catch {
            // Saving is optional; authentication remains successful if the browser declines it.
          }
        }
      }
      toast.success("تم تسجيل الدخول بنجاح", { id: toastId });
      router.replace("/");
    } catch (cause) {
      if (cause instanceof TypeError) {
        setError("تعذّر الاتصال بالخادم. تحقق من الاتصال وحاول مرة أخرى.");
      } else {
        const message = cause instanceof Error ? cause.message : "حدث خطأ غير متوقع.";
        setError(/401|403|422/.test(message) ? "البريد الإلكتروني أو كلمة المرور غير صحيحة." : message);
      }
      toast.error(error || "تعذر تسجيل الدخول.", { id: toastId });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page" dir="rtl">
      <section className="login-aside" aria-label="طريقك">
        <div className="login-aside-glow login-aside-glow-one" />
        <div className="login-aside-glow login-aside-glow-two" />
        <div className="login-aside-brand">
          <span className="brand-symbol"><MapPinned size={25} /></span>
          <span><b>طريقك</b><small>منصة البلاغات المجتمعية</small></span>
        </div>
        <div className="login-aside-copy">
          <span className="login-aside-tag"><i /> بوابة إدارة المنصة</span>
          <h1>مجتمعك<br /><em>يستحق الأفضل.</em></h1>
          <p>من مكان واحد، تابع البلاغات والخدمات المجتمعية وساعد فريقك على تحويل كل ملاحظة إلى خطوة للأمام.</p>
        </div>
        <div className="login-preview" aria-label="لمحة عن لوحة التحكم">
          <div className="login-preview-head">
            <span className="login-preview-symbol"><MapPinned size={16} /></span>
            <span><b>نظرة عامة</b><small>ملخص المنصة</small></span>
            <span className="login-preview-live"><i /> مباشر</span>
          </div>
          <div className="login-preview-stats">
            <div><span className="preview-stat-icon preview-icon-green"><FileCheck2 size={15} /></span><b>البلاغات</b><strong>متابعة أسهل</strong></div>
            <div><span className="preview-stat-icon preview-icon-gold"><UsersRound size={15} /></span><b>المجتمع</b><strong>أثر أوضح</strong></div>
          </div>
          <div className="login-preview-foot"><span><Check size={14} /> كل التفاصيل في مكان واحد</span><span className="preview-sparkline"><i /><i /><i /><i /><i /><i /><i /></span></div>
        </div>
        <div className="login-aside-footer"><ShieldCheck size={17} /><span>مساحة آمنة مخصصة لمسؤولي النظام</span></div>
      </section>
      <section className="login-content">
        <button className="login-theme-toggle" type="button" onClick={toggleTheme} aria-label={theme === "dark" ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن"} title={theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}>
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          <span>{theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}</span>
        </button>
        <div className="login-form-wrap">
          <div className="login-mobile-brand"><span className="brand-symbol"><MapPinned size={23} /></span><b>طريقك</b></div>
          <div className="login-title">
            <span className="login-eyebrow">أهلاً بعودتك</span>
            <h2>سجّل دخولك إلى حسابك</h2>
            <p>أدخل بيانات حساب المسؤول للوصول إلى لوحة تحكم طريقك.</p>
          </div>
          <form className="login-form" onSubmit={submit} autoComplete={remember ? "on" : "off"}>
            <label>
              البريد الإلكتروني
              <span className="login-input-wrap" dir="ltr">
                <Mail size={17} />
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete={remember ? "username" : "off"} autoFocus placeholder="admin@example.com" />
              </span>
            </label>
            <label>
              كلمة المرور
              <span className="login-input-wrap" dir="ltr">
                <LockKeyhole size={17} />
                <input type={show ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete={remember ? "current-password" : "off"} placeholder="أدخل كلمة المرور" />
                <button type="button" onClick={() => setShow(!show)} aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"} aria-pressed={show}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </span>
            </label>
            <label className="login-remember">
              <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
              <span>تذكرني</span>
            </label>
            {error && <p className="error-message" role="alert">{error}</p>}
            <button className="btn btn-primary login-submit" type="submit" disabled={loading}>
              {loading ? <><LoaderCircle size={17} className="login-spinner" /> جارٍ تسجيل الدخول</> : <>تسجيل الدخول <ArrowLeft size={17} /></>}
            </button>
          </form>
          <div className="login-assistance"><ShieldCheck size={16} /><span>بياناتك محمية وتُستخدم لتأمين الوصول إلى حسابك.</span></div>
          <div className="login-copyright">طريقك <i /> لخدمات مجتمعية أقرب وأفضل</div>
        </div>
      </section>
    </main>
  );
}


"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, UserRoundCheck, UserRoundX, Trash2, UsersRound, UserRound, Pencil, Eye } from "lucide-react";
import { adminRequest, UserRow } from "@/lib/admin-api";
import { InlineNumberLoader } from "@/components/InlineNumberLoader";
import { useLiveRefresh } from "@/lib/live-refresh";

type UsersResponse = { data: { citizens: UserRow[]; employees: UserRow[] } };
const roleNames: Record<string, string> = { admin: "مسؤول النظام", manager: "مدير", employee: "موظف" };
export default function UsersPage() {
  const [tab, setTab] = useState<"employees" | "citizens">("employees");
  const [citizens, setCitizens] = useState<UserRow[]>([]);
  const [employees, setEmployees] = useState<UserRow[]>([]);
  const [q, setQ] = useState(""); const [filter, setFilter] = useState("all"); const [open, setOpen] = useState(false);
  const emptyForm = () => ({ name: "", email: "", phone: "", password: "", confirmPassword: "", role: "employee", employee_number: "", job_title: "", department: "", employment_type: "full_time", hire_date: "", birth_date: "", gender: "", national_id: "", address: "", emergency_contact_name: "", emergency_contact_phone: "", salary: "", notes: "" });
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [viewCitizen, setViewCitizen] = useState<UserRow | null>(null);
  const [error, setError] = useState(""); const [loading, setLoading] = useState(true); const [pendingDelete, setPendingDelete] = useState<UserRow | null>(null);
  async function load(silent = false) {
    if (!silent) setLoading(true);
    try { const result = await adminRequest<UsersResponse>("/admin/users"); setCitizens(result.data.citizens); setEmployees(result.data.employees); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تحميل الحسابات."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  useLiveRefresh(() => load(true));
  const current = tab === "employees" ? employees : citizens;
  const filtered = useMemo(() => current.filter((u) => (filter === "all" || u.status === filter) && `${u.name} ${u.email ?? ""} ${u.phone} ${u.city ?? ""} ${u.role ?? ""}`.toLowerCase().includes(q.toLowerCase())), [current, filter, q]);
  async function update(user: UserRow, action: "status" | "delete") {
    try {
      if (action === "delete") {
        setPendingDelete(user);
        return;
      }
      const path = tab === "citizens" ? `/admin/users/${user.id}?type=citizen` : `/admin/users/${user.id}`;
      await adminRequest(path, { method: "PATCH", body: JSON.stringify({ status: user.status === "active" ? "blocked" : "active" }) });
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تحديث الحساب."); }
  }
  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      const path = tab === "citizens" ? `/admin/users/${pendingDelete.id}?type=citizen` : `/admin/users/${pendingDelete.id}`;
      await adminRequest(path, { method: "DELETE" });
      setPendingDelete(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر حذف الحساب.");
      setPendingDelete(null);
    }
  }
  function startCreate() { setEditing(null); setForm(emptyForm()); setError(""); setOpen(true); }
  function startEdit(user: UserRow) { const dates = new Set(["hire_date", "birth_date"]); setEditing(user); setForm({ ...emptyForm(), ...Object.fromEntries(Object.entries(user).map(([key, value]) => [key, value == null ? "" : dates.has(key) ? String(value).slice(0, 10) : String(value)])), password: "", confirmPassword: "" }); setError(""); setOpen(true); }
  async function saveEmployee(event: React.FormEvent) {
    event.preventDefault();
    if (( !editing || form.password || form.confirmPassword) && form.password !== form.confirmPassword) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }
    setError("");
    try {
      const payload = Object.fromEntries(Object.entries(form).filter(([key]) => key !== "confirmPassword" && (editing?.role !== "admin" || key !== "role")));
      await adminRequest(editing ? `/admin/users/${editing.id}` : "/admin/users", { method: editing ? "PATCH" : "POST", body: JSON.stringify(payload) });
      setForm(emptyForm());
      setEditing(null);
      setOpen(false);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر إنشاء الحساب.");
    }
  }
  return <>
    <section className="panel">
      {error && <p className="error-message" role="alert">{error}</p>}
      <div className="user-tabs" role="tablist" aria-label="نوع الحساب">
        <button className={`user-tab ${tab === "employees" ? "active" : ""}`} role="tab" aria-selected={tab === "employees"} onClick={() => { setTab("employees"); setQ(""); setFilter("all"); }}><UsersRound size={17} /> الموظفون <span>{loading ? <InlineNumberLoader label="جارٍ تحميل عدد الموظفين" /> : employees.length}</span></button>
        <button className={`user-tab ${tab === "citizens" ? "active" : ""}`} role="tab" aria-selected={tab === "citizens"} onClick={() => { setTab("citizens"); setQ(""); setFilter("all"); }}><UserRound size={17} /> المواطنون <span>{loading ? <InlineNumberLoader label="جارٍ تحميل عدد المواطنين" /> : citizens.length}</span></button>
      </div>
      <div className="toolbar"><div className="search-box"><Search size={17} /><input placeholder="ابحث بالاسم أو البريد أو الهاتف..." value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">كل المستخدمين</option><option value="active">نشط</option><option value="blocked">موقوف</option></select>
        {tab === "employees" ? <button className="btn btn-primary" onClick={startCreate}><Plus size={16} /> إنشاء حساب</button> : <span className="user-count">{loading ? <><InlineNumberLoader label="جارٍ تحميل عدد المواطنين" /> مواطن</> : `${citizens.length} مواطن`}</span>}
      </div>
      <div className="user-summary"><span><UserRoundCheck size={17} /> نشط: <b>{loading ? <InlineNumberLoader label="جارٍ تحميل عدد الحسابات النشطة" /> : current.filter((u) => u.status === "active").length}</b></span><span><UserRoundX size={17} /> موقوف: <b>{loading ? <InlineNumberLoader label="جارٍ تحميل عدد الحسابات الموقوفة" /> : current.filter((u) => u.status === "blocked").length}</b></span></div>
      <div className="table-wrap"><table><thead><tr><th>{tab === "employees" ? "الموظف" : "المواطن"}</th>{tab === "employees" && <th>الدور</th>}<th>الهاتف</th>{tab === "citizens" && <><th>المنطقة</th><th>اكتمال الملف</th><th>البلاغات</th></>}{tab === "employees" && <th>الحالة</th>}{tab === "citizens" && <th>الحالة</th>}<th>إجراءات</th></tr></thead>
        <tbody>{filtered.map((u) => <tr key={u.id}><td><div className="user-cell"><span className="avatar">{u.name.slice(0,1)}</span><span><b>{u.name}</b><small>{u.email || "—"}</small></span></div></td>{tab === "employees" && <td>{roleNames[u.role ?? "employee"]}</td>}<td>{u.phone}</td>{tab === "citizens" && <><td>{[u.city,u.governorate].filter(Boolean).join("، ") || "—"}</td><td><span className={`status-pill ${u.profile_complete ? "resolved" : "pending"}`}><i />{u.profile_complete ? "مكتمل" : "ناقص"}</span></td><td>{u.reports ?? 0}</td></>}<td><span className={`status-pill ${u.status === "active" ? "resolved" : "rejected"}`}><i />{u.status === "active" ? "نشط" : "موقوف"}</span></td><td><div className="inline-actions">{tab === "employees" ? <button className="icon-button" title="تعديل بيانات الموظف" aria-label={`تعديل ${u.name}`} onClick={() => startEdit(u)}><Pencil size={15} /></button> : <button className="icon-button" title="عرض ملف المواطن" aria-label={`عرض ملف ${u.name}`} onClick={() => setViewCitizen(u)}><Eye size={15} /></button>}<button className="btn btn-small btn-light" onClick={() => void update(u,"status")}>{u.status === "active" ? "إيقاف" : "تفعيل"}</button>{tab === "employees" && <button className="icon-button danger-icon" title="حذف الحساب" onClick={() => void update(u,"delete")}><Trash2 size={15} /></button>}</div></td></tr>)}</tbody></table>
        {loading ? <div className="empty-state">جارٍ تحميل الحسابات...</div> : !filtered.length && <div className="empty-state">لا توجد حسابات مسجلة تطابق البحث.</div>}
      </div>
    </section>
    {open && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}><form className="confirm-modal user-form employee-form modal-panel" role="dialog" aria-modal="true" aria-labelledby="employee-modal-title" onSubmit={saveEmployee}>
      <button type="button" className="modal-x" aria-label="إغلاق" onClick={() => setOpen(false)}>×</button>
      <header className="modal-heading"><span className="modal-heading-icon employee"><UsersRound size={20} /></span><div><h2 id="employee-modal-title">{editing ? "تعديل بيانات الموظف" : "إنشاء حساب موظف"}</h2><p>الملف الوظيفي وبيانات التواصل والصلاحيات.</p></div></header>
      <div className="modal-section"><h3 className="modal-section-title">البيانات الشخصية والتواصل</h3><div className="employee-form-grid">
        <label>الاسم الكامل<input required autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label>رقم الهاتف<input required type="tel" autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
        <label>البريد الإلكتروني<input required type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label>تاريخ الميلاد<input type="date" value={form.birth_date} onChange={(event) => setForm({ ...form, birth_date: event.target.value })} /></label>
        <label>النوع<select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })}><option value="">غير محدد</option><option value="male">ذكر</option><option value="female">أنثى</option><option value="other">آخر</option></select></label>
        <label>الرقم القومي<input value={form.national_id} onChange={(event) => setForm({ ...form, national_id: event.target.value })} /></label>
        <label className="wide-field">العنوان<input autoComplete="street-address" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
      </div></div>
      <div className="modal-section"><h3 className="modal-section-title">الوظيفة والتعيين</h3><div className="employee-form-grid">
        <label>الرقم الوظيفي<input value={form.employee_number} onChange={(event) => setForm({ ...form, employee_number: event.target.value })} /></label>
        <label>المسمى الوظيفي<input value={form.job_title} onChange={(event) => setForm({ ...form, job_title: event.target.value })} /></label>
        <label>القسم / الإدارة<input value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} /></label>
        <label>نوع التوظيف<select value={form.employment_type} onChange={(event) => setForm({ ...form, employment_type: event.target.value })}><option value="full_time">دوام كامل</option><option value="part_time">دوام جزئي</option><option value="contract">عقد</option><option value="internship">تدريب</option></select></label>
        <label>تاريخ التعيين<input type="date" value={form.hire_date} onChange={(event) => setForm({ ...form, hire_date: event.target.value })} /></label>
        <label>الراتب<input type="number" min="0" step="0.01" value={form.salary} onChange={(event) => setForm({ ...form, salary: event.target.value })} /></label>
      </div></div>
      <div className="modal-section"><h3 className="modal-section-title">جهة اتصال الطوارئ وملاحظات</h3><div className="employee-form-grid">
        <label>اسم جهة اتصال الطوارئ<input value={form.emergency_contact_name} onChange={(event) => setForm({ ...form, emergency_contact_name: event.target.value })} /></label>
        <label>هاتف الطوارئ<input type="tel" value={form.emergency_contact_phone} onChange={(event) => setForm({ ...form, emergency_contact_phone: event.target.value })} /></label>
        <label className="wide-field">ملاحظات إدارية<textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
      </div></div>
      <div className="modal-section"><h3 className="modal-section-title">الدخول والصلاحيات</h3><div className="employee-form-grid">
        {!editing && <><label>كلمة المرور<input required type="password" minLength={8} autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label><label>تأكيد كلمة المرور<input required type="password" minLength={8} autoComplete="new-password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} /></label></>}
        {editing && <><label>كلمة مرور جديدة (اختياري)<input type="password" minLength={8} autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label><label>تأكيد كلمة المرور الجديدة<input type="password" minLength={8} autoComplete="new-password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} /></label></>}
        <label>صلاحية الحساب<select disabled={editing?.role === "admin"} value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option value="employee">موظف</option><option value="manager">مدير</option>{editing?.role === "admin" && <option value="admin">مسؤول النظام</option>}</select></label>
      </div></div>
      {error && <p className="modal-inline-error" role="alert">{error}</p>}
      <footer className="modal-actions"><button type="button" className="btn btn-light" onClick={() => setOpen(false)}>إلغاء</button><button className="btn btn-primary">{editing ? <><Pencil size={15} /> حفظ التعديلات</> : <><Plus size={16} /> إنشاء الحساب</>}</button></footer>
    </form></div>}
    {pendingDelete && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setPendingDelete(null)}><section className="confirm-modal modal-panel danger-confirm" role="alertdialog" aria-modal="true" aria-labelledby="delete-user-title" aria-describedby="delete-user-copy"><button type="button" className="modal-x" aria-label="إغلاق" onClick={() => setPendingDelete(null)}>×</button><span className="modal-heading-icon danger"><Trash2 size={20} /></span><h2 id="delete-user-title">تأكيد حذف الحساب</h2><p id="delete-user-copy">سيتم حذف حساب <b>{pendingDelete.name}</b> نهائيًا. هل تريد المتابعة؟</p><footer className="modal-actions"><button className="btn btn-light" onClick={() => setPendingDelete(null)}>إلغاء</button><button className="btn btn-danger" onClick={() => void confirmDelete()}><Trash2 size={15} /> حذف الحساب</button></footer></section></div>}
    {viewCitizen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setViewCitizen(null)}><section className="confirm-modal modal-panel citizen-profile-modal" role="dialog" aria-modal="true" aria-labelledby="citizen-profile-title"><button type="button" className="modal-x" aria-label="إغلاق ملف المواطن" onClick={() => setViewCitizen(null)}>×</button><header className="modal-heading"><span className="modal-heading-icon employee"><UserRound size={20} /></span><div><h2 id="citizen-profile-title">ملف المواطن</h2><p>البيانات التي سجلها المواطن في التطبيق.</p></div></header><div className="citizen-profile-grid">{[["الاسم",viewCitizen.name],["الهاتف",viewCitizen.phone],["البريد الإلكتروني",viewCitizen.email],["النوع",viewCitizen.gender],["العمر",viewCitizen.age],["الرقم القومي",viewCitizen.national_id],["المحافظة",viewCitizen.governorate],["المنطقة",viewCitizen.city],["العنوان",viewCitizen.address],["عدد البلاغات",viewCitizen.reports],["تاريخ التسجيل",viewCitizen.citizen_created_at]].map(([label,value]) => <div key={label}><small>{label}</small><b>{value || "غير مسجل"}</b></div>)}</div><footer className="modal-actions"><button type="button" className="btn btn-light" onClick={() => setViewCitizen(null)}>إغلاق</button></footer></section></div>}
  </>;
}





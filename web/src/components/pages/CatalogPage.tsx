"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, MapPinned, Map, Siren } from "lucide-react";
import { adminRequest } from "@/lib/admin-api";
import { toast } from "sonner";

type Kind="governorate"|"center"|"problem_type";
type Item={id:number;kind:Kind;name:string;parent_name:string|null};
const tabs:{kind:Kind;label:string;Icon:typeof MapPinned}[]=[{kind:"governorate",label:"المحافظات",Icon:MapPinned},{kind:"center",label:"المراكز والمدن",Icon:Map},{kind:"problem_type",label:"أنواع المشكلات",Icon:Siren}];
export default function CatalogPage(){
  const [items,setItems]=useState<Item[]>([]); const [kind,setKind]=useState<Kind>("governorate"); const [loading,setLoading]=useState(true);
  const [name,setName]=useState(""); const [parent,setParent]=useState(""); const [editing,setEditing]=useState<number|null>(null); const [error,setError]=useState("");
  async function load(){try{await fetch("/api/citizen/catalog");const r=await adminRequest<{data:{items:Item[]}}>("/admin/catalog");setItems(r.data.items);setError("");}catch(e){setError(e instanceof Error?e.message:"تعذر تحميل البيانات.");}finally{setLoading(false);}}
  useEffect(()=>{void load();},[]);
  const visible=useMemo(()=>items.filter(x=>x.kind===kind),[items,kind]); const governors=items.filter(x=>x.kind==="governorate");
  async function save(e:React.FormEvent){e.preventDefault();try{if(editing){await adminRequest(`/admin/catalog/${editing}`,{method:"PATCH",body:JSON.stringify({name,parent_name:parent||null})});toast.success("تم تحديث العنصر");}else{await adminRequest("/admin/catalog",{method:"POST",body:JSON.stringify({kind,name,parent_name:kind==="center"?parent:null})});toast.success("تمت الإضافة");}setName("");setParent("");setEditing(null);await load();}catch(cause){setError(cause instanceof Error?cause.message:"تعذر حفظ البيانات.");}}
  function edit(item:Item){setEditing(item.id);setName(item.name);setParent(item.parent_name??"");}
  async function remove(item:Item){if(!window.confirm(`حذف «${item.name}»؟`))return;try{await adminRequest(`/admin/catalog/${item.id}`,{method:"DELETE"});toast.success("تم الحذف");await load();}catch(cause){setError(cause instanceof Error?cause.message:"تعذر الحذف.");}}
  return <section className="panel">
    <div className="appearance-heading"><span className="appearance-heading-icon"><MapPinned size={20}/></span><div><h2>بيانات التطبيق</h2><p>إدارة المحافظات والمراكز وأنواع المشكلات التي تظهر في تطبيق المواطن.</p></div></div>
    <div className="user-tabs" role="tablist">{tabs.map(({kind:k,label,Icon})=><button key={k} className={`user-tab ${kind===k?"active":""}`} role="tab" aria-selected={kind===k} onClick={()=>{setKind(k);setEditing(null);setName("");}}><Icon size={17}/>{label}<span>{items.filter(x=>x.kind===k).length}</span></button>)}</div>
    <form className="toolbar" onSubmit={save}>
      <input required aria-label="الاسم" placeholder={kind==="center"?"اسم المركز أو المدينة":"الاسم"} value={name} onChange={e=>setName(e.target.value)}/>
      {kind==="center"&&<select required aria-label="المحافظة" value={parent} onChange={e=>setParent(e.target.value)}><option value="">اختر المحافظة</option>{governors.map(x=><option key={x.id} value={x.name}>{x.name}</option>)}</select>}
      <button className="btn btn-primary" type="submit">{editing?<Pencil size={15}/>:<Plus size={15}/>} {editing?"حفظ التعديل":"إضافة"}</button>
      {editing&&<button type="button" className="btn btn-light" onClick={()=>{setEditing(null);setName("");setParent("");}}>إلغاء</button>}
    </form>
    {error&&<p className="error-message" role="alert">{error}</p>}
    <div className="table-wrap"><table><thead><tr><th>#</th><th>الاسم</th>{kind==="center"&&<th>المحافظة</th>}<th>إجراءات</th></tr></thead><tbody>{visible.map((item,i)=><tr key={item.id}><td>{i+1}</td><td><b>{item.name}</b></td>{kind==="center"&&<td>{item.parent_name||"—"}</td>}<td><div className="inline-actions"><button className="icon-button" title="تعديل" onClick={()=>edit(item)}><Pencil size={15}/></button><button className="icon-button danger-icon" title="حذف" onClick={()=>void remove(item)}><Trash2 size={15}/></button></div></td></tr>)}</tbody></table>{loading?<div className="empty-state">جارٍ التحميل...</div>:!visible.length&&<div className="empty-state">لا توجد بيانات بعد. أضف العنصر الأول من الأعلى.</div>}</div>
  </section>;
}

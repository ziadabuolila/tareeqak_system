"use client";
import { useEffect,useState } from "react";
import { Bell,CheckCheck,Trash2,Info,AlertTriangle,CheckCircle2 } from "lucide-react";
import { adminRequest,NoticeRow } from "@/lib/admin-api";
import { useLiveRefresh } from "@/lib/live-refresh";
function formatTime(value:string){const date=new Date(value.replace(" ","T")+"Z");return Number.isNaN(date.valueOf())?value:new Intl.DateTimeFormat("ar-EG",{dateStyle:"medium",timeStyle:"short"}).format(date);}
export default function NotificationsPage(){
  const [items,setItems]=useState<NoticeRow[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState("");
  async function load(silent=false){if(!silent)setLoading(true);try{const result=await adminRequest<{data:{notifications:NoticeRow[]}}>("/admin/notifications");setItems(result.data.notifications);setError("");}catch(e){setError(e instanceof Error?e.message:"ما قدرناش نحمّل الإشعارات دلوقتي.");}finally{setLoading(false);}}
  useEffect(()=>{void load();},[]);
  useLiveRefresh(()=>load(true));
  async function markAll(){try{await adminRequest("/admin/notifications",{method:"PATCH"});setItems((current)=>current.map((n)=>({...n,read:1})));}catch(e){setError(e instanceof Error?e.message:"تعذر تحديث الإشعارات.");}}
  async function change(id:number,action:"read"|"delete"){try{await adminRequest(`/admin/notifications/${id}`,{method:action==="read"?"PATCH":"DELETE"});setItems((current)=>action==="read"?current.map((n)=>n.id===id?{...n,read:1}:n):current.filter((n)=>n.id!==id));}catch(e){setError(e instanceof Error?e.message:"تعذر تحديث الإشعار.");}}
  return <section className="panel">{error&&<p className="error-message" role="alert">{error}</p>}<div className="panel-head"><div><h3>مركز الإشعارات</h3><p>إشعارات ناتجة عن البلاغات والتغييرات المسجلة.</p></div><button className="btn btn-light" onClick={()=>void markAll()} disabled={!items.some((n)=>!n.read)}><CheckCheck size={16}/> تحديد الكل كمقروء</button></div><div className="notice-list">{items.map((n)=>{const Icon=n.kind==="warning"?AlertTriangle:n.kind==="success"?CheckCircle2:Info;return <article className={`notice-card ${n.read?"is-read":""}`} key={n.id}><span className={`notice-icon ${n.kind}`}><Icon size={20}/></span><div className="notice-content"><div className="notice-title-row"><h3>{n.title}</h3>{!n.read&&<i className="unread-dot"/>}</div><p>{n.body}</p><small>{formatTime(n.created_at)}</small><div className="notice-actions">{!n.read&&<button className="text-button" onClick={()=>void change(n.id,"read")}>تحديد كمقروء</button>}<button className="text-button muted" onClick={()=>void change(n.id,"delete")}><Trash2 size={14}/> حذف</button></div></div></article>;})}{loading&&<div className="empty-state">جارٍ تحميل الإشعارات...</div>}{!loading&&!items.length&&<div className="empty-state"><Bell size={25}/> لا توجد إشعارات بعد. ستظهر هنا عند تسجيل البلاغات أو تحديثها.</div>}</div></section>;
}

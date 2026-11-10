import { NextResponse } from "next/server";
import { getAdminForRequest } from "@/lib/auth";
import { execute, assertDatabaseConfigured, row } from "@/lib/database";
import type { RowDataPacket } from "@/lib/database";

export const runtime = "nodejs";
type Context={params:Promise<{id:string}>};
export async function PATCH(request:Request,{params}:Context){
  await assertDatabaseConfigured(); if(!(await getAdminForRequest(request))) return NextResponse.json({message:"Unauthenticated."},{status:401});
  const {id}=await params; let body:{name?:string;parent_name?:string|null}; try{body=await request.json();}catch{return NextResponse.json({message:"البيانات غير صالحة."},{status:422});}
  const name=String(body.name??"").trim(); if(!name) return NextResponse.json({message:"الاسم مطلوب."},{status:422});
  const current=await row<{kind:string;name:string} & RowDataPacket>("SELECT kind,name FROM citizen_catalog WHERE id=$1",[Number(id)]);
  if(!current) return NextResponse.json({message:"العنصر غير موجود."},{status:404});
  const result=await execute("UPDATE citizen_catalog SET name=$1,parent_name=CASE WHEN kind='center' THEN $2 ELSE NULL END WHERE id=$3",[name,body.parent_name??null,Number(id)]);
  if(current.kind==="governorate") await execute("UPDATE citizen_catalog SET parent_name=$1 WHERE kind='center' AND parent_name=$2",[name,current.name]);
  return result.rowCount?NextResponse.json({status:true}):NextResponse.json({message:"العنصر غير موجود."},{status:404});
}
export async function DELETE(request:Request,{params}:Context){
  await assertDatabaseConfigured(); if(!(await getAdminForRequest(request))) return NextResponse.json({message:"Unauthenticated."},{status:401});
  const {id}=await params; const current=await row<{kind:string;name:string} & RowDataPacket>("SELECT kind,name FROM citizen_catalog WHERE id=$1",[Number(id)]);
  if(!current) return NextResponse.json({message:"العنصر غير موجود."},{status:404});
  if(current.kind==="governorate") await execute("DELETE FROM citizen_catalog WHERE kind='center' AND parent_name=$1",[current.name]);
  const result=await execute("DELETE FROM citizen_catalog WHERE id=$1",[Number(id)]);
  return result.rowCount?NextResponse.json({status:true}):NextResponse.json({message:"العنصر غير موجود."},{status:404});
}

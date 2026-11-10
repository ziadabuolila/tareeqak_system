import { NextResponse } from "next/server";
import { getAdminForRequest } from "@/lib/auth";
import { rows, execute, assertDatabaseConfigured } from "@/lib/database";
import type { RowDataPacket } from "@/lib/database";

export const runtime = "nodejs";
const kinds = new Set(["governorate", "center", "problem_type"]);
async function authorized(request: Request) { return Boolean(await getAdminForRequest(request)); }
async function ensureTable() { await execute(`CREATE TABLE IF NOT EXISTS citizen_catalog (id BIGSERIAL PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('governorate','center','problem_type')),name TEXT NOT NULL,parent_name TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(kind,name,parent_name))`); await execute("CREATE UNIQUE INDEX IF NOT EXISTS citizen_catalog_unique_idx ON citizen_catalog(kind,name,COALESCE(parent_name,''))"); }

export async function GET(request: Request) {
  await assertDatabaseConfigured();
  if (!(await authorized(request))) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  await ensureTable();
  const items = await rows<{id:number;kind:string;name:string;parent_name:string|null} & RowDataPacket>("SELECT id,kind,name,parent_name FROM citizen_catalog ORDER BY kind,name");
  return NextResponse.json({ status:true,data:{items} });
}

export async function POST(request: Request) {
  await assertDatabaseConfigured();
  if (!(await authorized(request))) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  await ensureTable();
  let body: {kind?:string;name?:string;parent_name?:string|null};
  try { body=await request.json(); } catch { return NextResponse.json({message:"البيانات غير صالحة."},{status:422}); }
  const kind=String(body.kind??""); const name=String(body.name??"").trim(); const parent=kind==="center"?String(body.parent_name??"").trim():null;
  if(!kinds.has(kind)||!name||(kind==="center"&&!parent)) return NextResponse.json({message:"النوع والاسم والمحافظة للمركز مطلوبة."},{status:422});
  const result=await rows<{id:number} & RowDataPacket>("INSERT INTO citizen_catalog(kind,name,parent_name) VALUES($1,$2,$3) RETURNING id",[kind,name,parent]);
  return NextResponse.json({status:true,data:{id:result[0]?.id,name,kind,parent_name:parent}},{status:201});
}

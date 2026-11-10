import { NextResponse } from "next/server";
import { getAdminForRequest } from "@/lib/auth";
import { rows, execute, assertDatabaseConfigured } from "@/lib/database";
import type { RowDataPacket } from "@/lib/database";

export const runtime = "nodejs";
const kinds = new Set(["governorate", "center", "problem_type"]);
async function authorized(request: Request) { return Boolean(await getAdminForRequest(request)); }
async function ensureTable() { await execute(`CREATE TABLE IF NOT EXISTS citizen_catalog (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,kind VARCHAR(32) NOT NULL,
  name VARCHAR(255) NOT NULL,parent_name VARCHAR(255) NULL,
  parent_name_key VARCHAR(255) GENERATED ALWAYS AS (COALESCE(parent_name,'')) STORED,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY citizen_catalog_unique_idx(kind,name,parent_name_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`); }

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
  const result=await execute("INSERT INTO citizen_catalog(kind,name,parent_name) VALUES(?,?,?)",[kind,name,parent]);
  return NextResponse.json({status:true,data:{id:result.insertId,name,kind,parent_name:parent}},{status:201});
}

import { NextResponse } from "next/server";
import { rows, database, assertDatabaseConfigured } from "@/lib/database";
import type { RowDataPacket } from "@/lib/database";

export const runtime = "nodejs";
type CatalogRow = { id: number; kind: string; name: string; parent_name: string | null } & RowDataPacket;

async function ensureCatalog() {
  const connection = await database.connect();
  try {
    await connection.query("BEGIN");
    await connection.query("SELECT pg_advisory_xact_lock(74832011)");
    await connection.query(`CREATE TABLE IF NOT EXISTS citizen_catalog (
    id BIGSERIAL PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('governorate','center','problem_type')),
    name TEXT NOT NULL,
    parent_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(kind, name, parent_name)
    )`);
    await connection.query("CREATE UNIQUE INDEX IF NOT EXISTS citizen_catalog_unique_idx ON citizen_catalog(kind,name,COALESCE(parent_name,''))");
    await connection.query("CREATE TABLE IF NOT EXISTS citizen_catalog_meta (seed_key TEXT PRIMARY KEY)");
    const seed = await connection.query("INSERT INTO citizen_catalog_meta(seed_key) VALUES('initial-v1') ON CONFLICT DO NOTHING RETURNING seed_key");
    if (!seed.rowCount) { await connection.query("COMMIT"); return; }
  const governors = ["القاهرة","الجيزة","الإسكندرية","الدقهلية","الشرقية","المنوفية","القليوبية","الغربية","البحيرة","كفر الشيخ","دمياط","بورسعيد","الإسماعيلية","السويس","شمال سيناء","جنوب سيناء","بني سويف","المنيا","أسيوط","سوهاج","قنا","الأقصر","أسوان","البحر الأحمر","الوادي الجديد","مطروح","الفيوم"];
  const problems = ["حفرة أو تلف بالطريق","تراكم قمامة","إنارة شارع","إشارة مرور","رصيف مكسور","تسرب مياه","أخرى"];
  const centers: Record<string,string> = {
    "القاهرة":"مدينة نصر,التجمع الخامس,المعادي,مصر الجديدة,الزمالك,شبرا,حلوان,المقطم,وسط البلد,عين شمس,المطرية,السلام,البساتين,السيدة زينب",
    "الجيزة":"الجيزة,الهرم,فيصل,6 أكتوبر,الشيخ زايد,العجوزة,الدقي,إمبابة,البدرشين,الحوامدية,أوسيم,كرداسة,أبو النمرس,العياط,الصف",
    "الإسكندرية":"المنتزه,شرق,وسط,غرب,العجمي,العامرية,برج العرب,سموحة,الإبراهيمية,ميامي,أبو قير",
    "الدقهلية":"المنصورة,ميت غمر,طلخا,نبروه,السنبلاوين,شربين,دكرنس,أجا,محلة دمنة,منية النصر,الجمالية,بلقاس,بني عبيد",
    "الشرقية":"الزقازيق,بلبيس,منيا القمح,فاقوس,أبو كبير,ههيا,ديرب نجم,كفر صقر,الإبراهيمية,الحسينية,أولاد صقر,مشتول السوق,القرين",
    "المنوفية":"شبين الكوم,منوف,قويسنا,أشمون,الباجور,تلا,سرس الليان,بركة السبع,السادات,الشهداء",
    "القليوبية":"بنها,شبرا الخيمة,قليوب,القناطر الخيرية,طوخ,كفر شكر,شبين القناطر,الخانكة",
    "الغربية":"طنطا,المحلة الكبرى,كفر الزيات,زفتى,سمنود,قطور,بسيون",
    "البحيرة":"دمنهور,كفر الدوار,إيتاي البارود,أبو حمص,حوش عيسى,رشيد,إدكو,كوم حمادة,الدلنجات,المحمودية,شبراخيت,بدر",
    "كفر الشيخ":"كفر الشيخ,دسوق,فوه,مطوبس,بلطيم,الحامول,بيلا,سيدي سالم,قلين",
    "دمياط":"دمياط,فارسكور,الزرقا,كفر البطيخ,كفر سعد,رأس البر,عزبة البرج,الروضة",
    "بورسعيد":"بورسعيد,بورفؤاد,حي الشرق,حي الضواحي,حي الزهور,حي العرب,حي المناخ",
    "الإسماعيلية":"الإسماعيلية,التل الكبير,فايد,القنطرة شرق,القنطرة غرب,أبو صوير,القصاصين",
    "السويس":"السويس,حي الأربعين,حي عتاقة,حي الجناين,حي بور توفيق",
    "شمال سيناء":"العريش,رفح,الشيخ زويد,بئر العبد,الحسنة,نخل",
    "جنوب سيناء":"الطور,شرم الشيخ,دهب,نويبع,طابا,سلطنت كاتدرائية,أبو رديس,أبو زنيمة,راس سدر",
    "بني سويف":"بني سويف,الواسطى,ناصر,إهناسيا,ببا,الفشن,سمسطا","المنيا":"المنيا,ملوي,سمالوط,أبوقرقاص,ديرمواس,مغاغة,بني مزار,العدوة",
    "أسيوط":"أسيوط,ديروط,منفلوط,القوصية,أبوتيج,ساحل سليم,البداري,صدفا,الغنايم,أبنوب","سوهاج":"سوهاج,طهطا,جرجا,البلينا,أخميم,ساقلتة,دار السلام,المنشأة,جهينة",
    "قنا":"قنا,نجع حمادي,دشنا,قوص,أبو تشت,نقادة,الوقف","الأقصر":"الأقصر,إسنا,أرمنت,القرنة,البياضية,الطود,الزينية",
    "أسوان":"أسوان,كوم أمبو,إدفو,دراو,نصر النوبة","البحر الأحمر":"الغردقة,سفاجا,القصير,مرسى علم,راس غارب,شلاتين,حلايب",
    "الوادي الجديد":"الخارجة,الداخلة,الفرافرة,باريس,بلاط","مطروح":"مرسى مطروح,الحمام,الضبعة,العلمين,سيدي براني,السلوم,سيوة","الفيوم":"الفيوم,سنورس,إطسا,طامية,يوسف الصديق,أبشواي"
  };
    for (const name of governors) await connection.query("INSERT INTO citizen_catalog(kind,name) VALUES('governorate',$1) ON CONFLICT DO NOTHING", [name]);
    for (const [governorate, names] of Object.entries(centers)) for (const name of names.split(",")) await connection.query("INSERT INTO citizen_catalog(kind,name,parent_name) VALUES('center',$1,$2) ON CONFLICT DO NOTHING", [name, governorate]);
    for (const name of problems) await connection.query("INSERT INTO citizen_catalog(kind,name) VALUES('problem_type',$1) ON CONFLICT DO NOTHING", [name]);
    await connection.query("COMMIT");
  } catch (error) { await connection.query("ROLLBACK"); throw error; }
  finally { connection.release(); }
}

export async function GET(request: Request) {
  await assertDatabaseConfigured();
  await ensureCatalog();
  const params = new URL(request.url).searchParams;
  const governorate = params.get("governorate");
  const kind = params.get("kind");
  const items = await rows<CatalogRow>(`SELECT id,kind,name,parent_name FROM citizen_catalog
    WHERE ($1::text IS NULL OR kind=$1) AND ($2::text IS NULL OR kind<>'center' OR parent_name=$2)
    ORDER BY name`, [kind, governorate]);
  return NextResponse.json({ status: true, data: { items } });
}

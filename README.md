# طريقك — لوحة التحكم والـ API

واجهة Next.js وواجهات API متصلة بقاعدة MySQL أو MariaDB، ولا يحتاج النظام إلى Laravel منفصل. يمكن إنشاء قاعدة البيانات وإدارتها من phpMyAdmin.

## التشغيل المحلي

يتطلب Node.js 22.13 أو أحدث وقاعدة MySQL/MariaDB. انسخ `web/.env.example` إلى `web/.env.local` واكتب بيانات اتصال قاعدة البيانات التي أنشأتها من لوحة الاستضافة.

قبل التشغيل الأول، اختر قاعدة البيانات في phpMyAdmin واستورد الملف `web/mysql-schema.sql`. هذا ينشئ جداول النظام المطلوبة.

```powershell
npm install
npm run dev
```

افتح [http://localhost:3000](http://localhost:3000) للوحة التحكم. تستطيع إدارة قاعدة البيانات من phpMyAdmin.

استخدم في `web/.env.local` إما `DATABASE_URL` بصيغة `mysql://USER:PASSWORD@HOST:3306/DATABASE`، أو عيّن `DB_HOST` و`DB_PORT` و`DB_NAME` و`DB_USER` و`DB_PASSWORD` كلًا على حدة. في cPanel استخدم اسم قاعدة البيانات والمستخدم الكاملين اللذين تعرضهما لوحة التحكم، وغالبًا يتضمنان بادئة الحساب.

تحقق من الاتصال والجداول عبر `npm run db:check --workspace tareeqak-admin-web`.

## حسابات الدخول والبيانات

- دخول اللوحة مخصص للموظفين والمديرين المسجلين في تبويب **المستخدمون ← الموظفون**.
- تطبيق Android يستخدم واجهات المواطنين؛ التسجيل ينشئ الحساب في تبويب **المستخدمون ← المواطنون**، والدخول للموبايل يتم برقم الهاتف.
- بيانات الدخول والجداول تعتمد على قاعدة MySQL التي تم إعدادها.
- تنتهي جلسة اللوحة بعد ساعة من عدم النشاط، وتُفحص الصلاحية من الخادم قبل فتح الصفحات المحمية.

لإنشاء أول مدير، عيّن `TAREEQAK_ADMIN_NAME` و`TAREEQAK_ADMIN_EMAIL` و`TAREEQAK_ADMIN_PHONE` و`TAREEQAK_ADMIN_PASSWORD` في `web/.env.local`، ثم شغّل `npm run admin:create --workspace tareeqak-admin-web` من مجلد المشروع. يجب استيراد المخطط وإعداد الاتصال أولًا.

## واجهات Android API

- `POST /api/citizen/register`
- `POST /api/citizen/login`
- `GET /api/citizen/me` مع Bearer token
- `GET/PATCH /api/citizen/profile` لعرض وتحديث بيانات المواطن
- طلبات موافقة الجهاز الجديد موثقة في `api/README.md` وتتطلب مخطط قاعدة البيانات المحدّث
- `GET /api/citizen/reports` و`POST /api/citizen/reports`
- تسجيل دخول لوحة الموظفين: `POST /api/admin/login`



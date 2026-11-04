# طريقك — لوحة التحكم والـ API

واجهة Next.js وواجهات API تعمل على MySQL/MariaDB، ويمكن إدارة قاعدة البيانات من phpMyAdmin. لا يحتاج النظام إلى Laravel منفصل.

## التشغيل المحلي

يتطلب Node.js 22.13 أو أحدث وMySQL/MariaDB شغالًا (إعداد XAMPP الافتراضي: `127.0.0.1:3306`). إعداد الاتصال موجود محليًا في `web/.env.local`، ومثال الإعداد في `web/.env.example`.

```powershell
npm install
npm run dev
```

افتح [http://localhost:3000](http://localhost:3000) للوحة، و[http://localhost/phpmyadmin](http://localhost/phpmyadmin) لإدارة البيانات. اسم قاعدة البيانات هو `tareeqak_system`. ينشئ Next الجداول تلقائيًا عند أول طلب API.

## حسابات الدخول والبيانات

- دخول اللوحة مخصص للموظفين والمديرين المسجلين في تبويب **المستخدمون ← الموظفون**.
- تطبيق Android يستخدم واجهات المواطنين؛ التسجيل ينشئ الحساب في تبويب **المستخدمون ← المواطنون**، والدخول للموبايل يتم برقم الهاتف.
- قاعدة البيانات الجديدة تبدأ بحساب موظف واحد فقط؛ البلاغات والمواطنون والإشعارات والإعدادات تبدأ فارغة.
- تنتهي جلسة اللوحة بعد ساعة من عدم النشاط، وتُفحص الصلاحية من الخادم قبل فتح الصفحات المحمية.

لإضافة مدير يدويًا، مرّر بياناته من متغيرات البيئة ثم شغّل `npm run admin:create` من مجلد المشروع. يجب أن تكون قاعدة MySQL جاهزة أولًا.

## واجهات Android API

- `POST /api/citizen/register`
- `POST /api/citizen/login`
- `GET /api/citizen/me` مع Bearer token
- `GET /api/citizen/reports` و`POST /api/citizen/reports`
- تسجيل دخول لوحة الموظفين: `POST /api/admin/login`



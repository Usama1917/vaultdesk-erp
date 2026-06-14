# VaultDesk — تقرير جاهزية الدمج كصفحة في ERP

> **تاريخ المراجعة:** 2026-06-14
> **السؤال المحوري:** بعد انتهاء التطوير، هل يمكن إضافة VaultDesk كصفحة (`/app/vaultdesk`) داخل ERPNext الحيّ؟ وما الذي يجب التأكّد منه؟
> **النتيجة:** الـ wiring الأساسي **صحيح ومتين**، لكن توجد نقاط يجب معالجتها قبل الدمج (أبرزها: `bench build` إلزامي، تطبيق RTL في الوضع الحيّ، أقسام UI بلا backend، وعدم وجود رابط Workspace).
> **ملاحظة:** قراءة فقط — لم يُعدَّل أي كود.

---

## 1) آلية تحميل الأصول — ✅ صحيحة (مع شرط واحد إلزامي)

- الصفحة في Desk تحمّل التطبيق عبر **dynamic import أصلي** للـ ES module:
  [page/vaultdesk/vaultdesk.js:11-12](vaultdesk/vaultdesk/page/vaultdesk/vaultdesk.js#L11-L12) → `import("/assets/vaultdesk/vaultdesk/app.js")` + تحميل الـ CSS عبر `frappe.require`، ثم `mountVaultDesk(mount, { apiMode: 'live', ... })`.
- ✅ **كل الـ imports نسبية** (`./api.js`, `./components/*.js` ...) وتُحَل بشكل صحيح نسبةً لـ `/assets/vaultdesk/vaultdesk/` وقت التشغيل — **بلا حاجة** لـ import map ولا bundling.
- ✅ المسار الفيزيائي صحيح: `public/vaultdesk/` → `/assets/vaultdesk/vaultdesk/`.
- ✅ التغليف سليم: `MANIFEST.in` و`[tool.flit.sdist]` يضمّان أصول `public`، و`modules.txt` يطابق module الصفحة.

> ⚠️ **مهم جداً (لا تفعل):** **لا تُضِف** `app_include_js` أو `page_js` أو `build.json` أو bundle عبر esbuild ولا import map. الكود مصمَّم عمداً على dynamic import لـ ES module ثابت، وإضافة bundling **ستكسره**.

### 🔴 BLOCKER إلزامي: `bench build`
الأصول في `public/` **لا تُخدَم** حتى يتم بناؤها/ربطها:
```bash
bench --site <site> install-app vaultdesk
bench build --app vaultdesk      # ← الخطوة التي تجعل /assets/vaultdesk/vaultdesk/app.js قابلاً للوصول
bench --site <site> migrate
```
على تثبيت جديد، `import()` سيعطي 404 حتى يُنفَّذ `bench build`. **تحقّق في DevTools → Network** أن `GET /assets/vaultdesk/vaultdesk/app.js` و`vaultdesk.css` يردّان `200` بنوع JS صحيح، وأن طلبات الأبناء (`./api.js` …) تردّ `200` أيضاً، قبل توقّع ظهور الصفحة.

### 🟠 Medium: لا يوجد cache-busting على import الصفحة
- المعاينة المستقلة تضيف `?v=...` لكسر الكاش ([index.html](vaultdesk/public/vaultdesk/index.html))، لكن صفحة Desk تستورد `app.js`/`vaultdesk.css` **بلا** معلمة إصدار → بعد ترقية + `bench build` قد يحصل المستخدمون على نسخة قديمة من الكاش.
- **التوصية:** أضِف `?v=<app_version>` على رابطي الـ CSS وapp.js في [vaultdesk.js:11-12](vaultdesk/vaultdesk/page/vaultdesk/vaultdesk.js#L11-L12).

---

## 2) الـ Runtime / الربط الحيّ — ✅ ممتاز (مع 3 نقاط)

- ✅ الصفحة تُركَّب في الوضع **live** فعلاً (`apiMode:'live'` → `LiveVaultDeskApi`).
- ✅ **كل** مسارات الميثودات (`folders.*`، `files.*`، `permissions.*`) **تطابق** ميثودات Python المُصرّح بها (whitelisted) — لا يوجد أي عدم تطابق.
- ✅ `frappe.call` مستخدمة بشكل صحيح؛ عمليات التغيير تمرّر POST مطابقةً لحرّاس `require_post()` في الخادم.
- ✅ CSRF للرفع: يُضاف `X-Frappe-CSRF-Token` عند توفّره؛ و`frappe.call` تحقن الرمز تلقائياً.
- ✅ التحميل/المعاينة الثنائية تعمل عبر مسار منفصل (window.open / fetch → blob) لأن استجابة `frappe.response.type='download'` ليست JSON-RPC — وهذا **صحيح ومقصود**.
- ✅ كشف اللغة في الوضع الحيّ يقرأ من `frappe.boot.lang` → `frappe.boot.user.language` → `frappe.lang`، وتبديل اللغة معطّل في الوضع الحيّ (اللغة تتبع مستخدم Frappe) — سلوك صحيح لـ Desk.
- ✅ `prefers-reduced-motion` مُحترَم.

### 🔴 High: RTL لا يُطبَّق إطلاقاً في الوضع الحيّ
- [app.js:70-90](vaultdesk/public/vaultdesk/app.js#L70-L90): ضبط `dir`/`lang` يحدث **فقط** عندما `api.mode === 'mock'`. في الوضع الحيّ يُتخطّى كلياً — فحتى لو حلّ i18n العربية بشكل صحيح، **لا شيء يكتب `dir='rtl'`** على عنصر التركيب، فتُعرَض الواجهة العربية LTR.
- **التوصية:** في `initialize()`، اضبط `dir`/`lang` على عنصر التركيب (`.vaultdesk-shell`) من `this.i18n` **بلا شرط الوضع** (واترك `<html>` لـ Frappe). *(هذه النقطة تتقاطع مع تطوير الـ UI القادم — ستُعالَج ضمنه.)*

### 🔴 High: قسما "Shared with me" و"Trash" موجودان في الواجهة بلا backend حيّ
- [api.js:27-37](vaultdesk/public/vaultdesk/api.js#L27-L37): `getSection` يعالج `recent` و`starred` فقط؛ أي قسم آخر يرمي خطأ "غير مُنفَّذ في الـ backend". أزرار **Shared** و**Trash** في الشريط الجانبي ([layout.js:40-50](vaultdesk/public/vaultdesk/components/layout.js#L40-L50)) ستُظهر خطأً للمستخدم الحيّ.
- **التوصية:** إمّا إخفاء/تعطيل الزرّين في الوضع الحيّ، أو إضافة ميثودات backend (`get_shared_items` + قائمة trash) وربطها. *(الـ README يذكر هذين كمطلوبين قبل الإنتاج.)*

### 🟠 Medium: إدارة الإصدارات (Versions) معطّلة في الوضع الحيّ بلا backend
- `supportsVersions()` يعيد true فقط في وضع mock ([app.js:1289-1291](vaultdesk/public/vaultdesk/app.js#L1289-L1291))؛ لا توجد ميثودات إصدارات حيّة. الميزة **mock فقط** حالياً.
- **التوصية:** إن كانت مطلوبة حيّاً، ابنِ ميثودات backend + LiveVaultDeskApi وارفع شرط `supportsVersions()`؛ وإلا وثّقها كـ mock فقط.

---

## 3) الأدوار والصلاحيات والإقلاع (Bootstrap) — ✅ صحيح (مع 4 نقاط)

- ✅ بوابة الصفحة صحيحة: محصورة بـ `VaultDesk User/Manager/Administrator` + `System Manager` ([vaultdesk.json:6-19](vaultdesk/vaultdesk/page/vaultdesk/vaultdesk.json#L6-L19)).
- ✅ إقلاع الـ Space تلقائي وصحيح: إدراج `VaultDesk Space` → `after_insert` ينشئ الجذر (break_inheritance) ويمنح المالك تحكّماً كاملاً ([vaultdesk_space.py:15-19](vaultdesk/vaultdesk/doctype/vaultdesk_space/vaultdesk_space.py#L15-L19)).
- ✅ `get_spaces` يعيد فارغاً لمستخدم بلا منح، و**الحالة الفارغة في الواجهة سليمة** (بطاقة خطأ + "حاول مجدداً"، ليست شاشة بيضاء).
- ✅ الأدوار الثلاثة تُنشأ عبر `after_install`، والتحصين على مستوى المستند (`permission_query_conditions` + `has_permission`) قائم.

### 🔴 High: لا يوجد رابط Workspace — الصفحة غير قابلة للوصول من الواجهة افتراضياً
- لا يوجد أي Workspace/shortcut/card في التطبيق. الصفحة موجودة على `/app/vaultdesk` ومحميّة بالأدوار، لكن **لا شيء في تنقّل ERP يشير إليها** — المستخدم يجب أن يكتب الـ URL يدوياً.
- **التوصية:** أنشئ Workspace أو Shortcut يدوياً (نوع الرابط: Page، link_to: `vaultdesk`)، أو **الأفضل**: اشحن Workspace fixture مع التطبيق ليُثبَّت تلقائياً.

### 🟠 Medium: إنشاء أول Space ممكن من Desk فقط وغير مكتشَف
- لا توجد API/واجهة لإنشاء Space؛ يجب فعلها من نموذج `VaultDesk Space` في Desk (محصور بـ Administrator/System Manager). مدير يرى الصفحة المخصّصة فقط لن يجد مساراً لإنشاء أول Space.
- **التوصية:** وثّق المسار (New > VaultDesk Space)، أو أضِف زرّ "Create Space" للمدير في الحالة الفارغة، أو رابطاً لقائمة Space.

### 🟠 Medium: إنشاء الأدوار غير idempotent عند الإضافة لموقع قائم
- `after_install` يعمل على **التثبيت الجديد فقط**؛ عند إضافة التطبيق لـ ERP قائم ثم migrate قد لا تُنشأ الأدوار الثلاثة، فتشير الصفحة/الصلاحيات لأدوار غير موجودة.
- **التوصية:** انقل إنشاء الأدوار إلى patch في `patches.txt` أو hook لـ `after_migrate` مع نفس حارس "if not exists" ليصبح idempotent.

### 🟡 Low: دور "VaultDesk Manager" بلا صلاحيات فعلية مميّزة
- يفتح الصفحة لكنه **ليس** ضمن `ADMIN_ROLES` ([constants.py:15](vaultdesk/services/constants.py#L15))، فيُعامَل كـ User عادي (يحتاج منحاً صريحاً، لا ينشئ Spaces). الاسم يوحي بصلاحيات لا يملكها.
- **التوصية:** إمّا إضافته لـ `ADMIN_ROLES`/الصلاحيات المناسبة إن كان مقصوداً أن يكون مميّزاً، أو توثيق أنه مطابق وظيفياً لـ User.

---

## 4) قائمة تحقّق الدمج النهائية (Integrator Checklist)

```bash
# 1) التثبيت
bench get-app /path/to/vaultdesk-erp
bench --site <site> install-app vaultdesk

# 2) إلزامي: بناء الأصول (وإلا الصفحة لن تُركَّب)
bench build --app vaultdesk

# 3) ترحيل (تسجيل الصفحة + DocTypes + الأدوار)
bench --site <site> migrate
```
4. تحقّق في DevTools أن `/assets/vaultdesk/vaultdesk/app.js` و`vaultdesk.css` يردّان 200.
5. اضبط `VaultDesk Settings` (الحجم الأقصى، **`allowed_file_extensions`** — فارغ = الرفع معطّل، `previewable_mime_types`، `trash_retention_days`).
6. أنشئ أول `VaultDesk Space` من Desk (New > VaultDesk Space) بمالك (`owner_user`).
7. امنح المستخدمين الأدوار، ثم منح `view` على الجذر/المجلدات عبر واجهة الصلاحيات.
8. أضِف Workspace/Shortcut يدوياً لـ `vaultdesk`.
9. (يُعالَج ضمن تطوير الـ UI) طبّق RTL على عنصر التركيب، وعالِج قسمي Shared/Trash.
10. شغّل سيناريوهات [docs/SECURITY_TEST_PLAN.md](docs/SECURITY_TEST_PLAN.md) قبل الإطلاق.

---

## خلاصة الجاهزية

| البند | الحالة |
|---|---|
| تحميل الأصول (dynamic import) | ✅ صحيح — يتطلّب `bench build` فقط |
| تطابق ميثودات API الحيّة | ✅ مطابق بالكامل |
| CSRF / الرفع / التحميل الثنائي | ✅ صحيح |
| بوابة الأدوار + إقلاع Space | ✅ صحيح |
| **RTL في الوضع الحيّ** | 🔴 غير مطبَّق (يُعالَج ضمن الـ UI) |
| **أقسام Shared / Trash** | 🔴 بلا backend حيّ |
| **رابط Workspace** | 🔴 غير موجود |
| cache-busting / idempotent roles / Versions backend | 🟠 يُفضَّل معالجتها |

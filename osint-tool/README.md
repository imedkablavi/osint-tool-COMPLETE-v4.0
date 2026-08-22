# OSINT Tool v4.1

تطبيق سطح مكتب مبني بـ Electron لتنظيم حالات OSINT المشروعة وجمع بيانات من مصادر عامة حقيقية مع حفظ مصدر كل دليل. الهدف في v4.1 هو أن تكون كل نتيجة قابلة للتفسير والتدقيق، وألا تظهر بيانات تجريبية أو عشوائية على أنها نتائج حقيقية.

## نظام الأدوات الحالي

### 1. Public Profile Intelligence

المسار الأساسي لاسم المستخدم يعمل مباشرة بدون أدوات خارجية:

- **GitHub REST API**: مطابقة username مباشرة مع بيانات عامة مثل الاسم، bio، الصورة، followers/following، الموقع، الشركة، public email، website، repos وتواريخ الحساب عندما يوفرها GitHub.
- **GitLab Users API**: مطابقة username مباشرة والحقول العامة التي يعيدها GitLab.
- **Official Hacker News API**: username، about، karma، تاريخ إنشاء الحساب وعدد العناصر المرسلة.
- **Public-page probes** منخفضة الثقة لعدد محدود من المواقع التي لا توفر anonymous profile API مناسبًا. هذه النتائج تُعرض كدليل صفحة عامة فقط، وليس إثبات هوية.

نتائج الـAPI الرسمية تحصل على Evidence Quality أعلى من page probes، لكن الدرجة لا تعني احتمال أن الحساب يعود لنفس الشخص.

### 2. Extended Username Search

اختياري من الواجهة:

- **Sherlock** إذا كان مثبتًا محليًا ومتاحًا في `PATH`.
- **Maigret** إذا كان مثبتًا محليًا ومتاحًا في `PATH`.

التطبيق يفحص توفر الأداتين تلقائيًا. التنفيذ يستخدم subprocess بدون shell command strings، مع validation للـusername وtimeout وحدود لحجم المخرجات. Maigret يُقرأ من تقرير `simple JSON` machine-readable بدل تحليل console text. يتم deduplicate للروابط قبل إضافتها إلى الحالة.

هذه النتائج تحتاج تحققًا يدويًا لأن أدوات username enumeration نفسها قد تنتج false positives.

### 3. Breach Intelligence

- **Have I Been Pwned API v3** عند ضبط API key صالح.
- لا يتم إنشاء أي breach records عند عدم وجود المفتاح.
- كل سجل محفوظ يملك provenance يوضح أن المصدر هو HIBP ونوع السجل ووقت الملاحظة وجودة الدليل.
- المفتاح يُخزن عبر Electron `safeStorage` ولا يُعاد إلى renderer بعد الحفظ. على Linux يتم رفض backend من نوع `basic_text`.

### 4. Domain Intelligence

للنطاق المشتق من بريد غير استهلاكي، التطبيق يجمع عدة مصادر مستقلة بالتوازي:

- **RDAP** لبيانات التسجيل المتاحة للعامة.
- **Google Public DNS DoH** للسجلات `A`, `AAAA`, `MX`, `NS`, `TXT`, `CAA` و`_dmarc`.
- تحليل **SPF / DMARC** من DNS الحقيقي.
- **Certificate Transparency** best-effort لاستخراج أسماء ظهرت في شهادات عامة.

إذا تعطل مصدر واحد لا تُرمى بقية النتائج؛ يتم حفظ حالة كل مصدر داخل record. نطاقات Gmail/Outlook/Proton وغيرها يتم تخطيها لأن بنية النطاق لا تكون دليلًا متعلقًا بصاحب البريد الفردي.

### 5. Evidence Provenance

كل حالة تملك جدول `source_evidence` منفصلًا. سجل الدليل يحتوي على:

- اسم المصدر ونوعه
- نوع الكيان ورقمه
- نوع الملاحظة / evidence method
- رابط المصدر عند توفره
- وقت الجمع
- Evidence Quality من 0 إلى 100
- metadata خاصة بالمصدر

يوجد تبويب **Evidence** داخل التطبيق، كما يتم تضمين السجلات نفسها في JSON وHTML export. عند فتح بيانات أقدم، يقوم Evidence Recorder بإنشاء provenance فقط عندما يستطيع استنتاج المصدر من metadata المحفوظة؛ لا يتم اختلاق مصدر لسجل مجهول.

### 6. Correlation

Correlation Engine يربط البيانات بعد جمعها، لكنه لا يعتبر درجات التشابه احتمالات هوية.

- تطابق username = علاقة "مطابقة اسم مستخدم".
- ظهور البريد في HIBP = علاقة "البريد ظهر في".
- domain المستخرج من البريد = "نطاق البريد"، وليس "يملك النطاق".
- تشابه اسم/bio/avatar بين حسابين = **attribute similarity** فقط.

`overallConfidence` في التقرير يعني Aggregate Evidence Quality، وليس probability أن الشخص هو صاحب كل الحسابات.

### 7. Local Image Evidence

`ImageAnalyzer` أصبح local-file only:

- SHA-256 حقيقي للملف
- حجم وامتداد وتاريخ تعديل
- EXIF حقيقي عبر **ExifTool** إذا كان مثبتًا
- camera/image/capture/GPS metadata عندما تكون موجودة

لا يقبل remote image URLs ولا يرفع صور المستخدم تلقائيًا لخدمات خارجية.

## أدوات معطلة عمدًا

بعض الملفات القديمة ما زالت موجودة للتوافق، لكن المسارات المضللة أُوقفت:

- **Face / reverse-image search**: النسخة القديمة كانت تولد URLs وmatches تجريبية. الآن ترجع `unavailable` بدون أي نتيجة حتى يتم دمج provider حقيقي ومرخّص وقابل للتدقيق.
- **Holehe-style account recovery enumeration**: معطل لأن إشارات recovery/rate-limit ليست دليلًا ثابتًا بما يكفي للتقارير التجارية.
- **Google result-page scraping**: معطل. الوحدة الحالية تبني investigator-assisted queries فقط ولا تحفظ search results غير موثوقة.
- أي module يستخدم `Math.random()` أو synthetic result URLs كدليل يجب أن يفشل regression tests.

راجع [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) لعقد كل مصدر بالتفصيل.

## إدارة الحالات والتصدير

- SQLite داخل مجلد بيانات التطبيق الخاص بالمستخدم.
- حذف الحالة بتأكيد على مرحلتين مع حذف transactional للبيانات التابعة وEvidence records.
- JSON export schema **1.1** يتضمن النتائج، graph، logs، `evidence[]` وprovenance.
- HTML export ذاتي الاحتواء وبدون JavaScript مع CSP وescaping للبيانات الخارجية وجدول Evidence Provenance.

## الأمان

- `nodeIntegration: false`
- `contextIsolation: true`
- Electron sandbox و`webSecurity` مفعّلان
- renderer يتعامل فقط مع API محدود عبر `preload.js`
- IPC sender validation
- روابط خارجية HTTPS فقط
- deny افتراضي لصلاحيات Electron غير المطلوبة
- SQLite/WAL/SHM مستبعدة من Git
- subprocess integrations تستخدم `spawn(..., { shell: false })`

## المتطلبات

- Node.js 22 أو أحدث للتطوير
- npm
- نظام سطح مكتب مدعوم من Electron
- اختياري: HIBP API key
- اختياري: `sherlock` و`maigret` للبحث الموسع
- اختياري: `exiftool` لتحليل EXIF محليًا

## التثبيت

```bash
cd osint-tool
npm install
npm start
```

وضع التطوير:

```bash
npm run dev
```

## بناء نسخ التثبيت

```bash
npm run build:linux
npm run build:win
npm run build:mac
```

النواتج داخل `dist/`.

## الاختبارات

```bash
npm run check
```

الاختبارات تشمل syntax checks وregressions لـ:

- GitHub / GitLab / Hacker News mappings
- RDAP وDNS/SPF/DMARC parsing
- Sherlock parser وinput validation
- Maigret simple JSON parsing
- HIBP schema mapping
- Evidence provenance persistence/backfill/delete
- report export + XSS escaping + provenance
- منع fabricated face/image evidence و`Math.random()` في modules الحساسة
- Electron security configuration

## الخصوصية والاستخدام

البيانات الخاصة بالحالات محفوظة محليًا. كل مصدر خارجي يستقبل فقط identifier اللازم للاستعلام الخاص به. الأداة مخصصة للاستخدامات المصرح بها والمشروعة مثل البحث الأمني، التحقيقات المصرح بها، due diligence، والتحقق من المعلومات العامة.

وجود username أو email أو domain في مصدر عام لا يثبت وحده هوية الشخص أو ملكيته للحساب/النطاق. يجب إجراء تحقق بشري قبل استخدام النتيجة في قرار أو استنتاج رسمي.

## ما ينقص قبل Release تجاري نهائي

- توقيع وnotarization للملفات التنفيذية
- نظام تحديث آمن
- migrations versioned لقاعدة البيانات
- E2E + accessibility tests
- native PDF export
- UI كامل لـLocal Image Analyzer
- Search API adapter رسمي بدل investigator-assisted query builder
- crash reporting اختياري ويحافظ على الخصوصية
- screenshots ووثائق إصدار ودعم واضحة

## الترخيص

MIT للمشروع. الخدمات الخارجية مثل HIBP وGitHub/GitLab وغيرها لها شروط استخدام وسياسات rate limits منفصلة ويجب الالتزام بها.

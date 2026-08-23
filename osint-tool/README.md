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

### 2. Web Search Intelligence

عند ضبط **Brave Search API key** من الإعدادات، التطبيق يشغل Web Search رسمي أثناء الحالة بدل scraping صفحات نتائج البحث.

- المفتاح يحفظ عبر Electron `safeStorage` ولا يُعاد إلى renderer بعد الحفظ.
- الاستعلامات محدودة بحد أقصى 6 لكل تشغيل حالة، مع budget صغير للنتائج.
- يتم توليد استعلامات من email / username / name المتاحة فقط.
- النتائج تُخزن في `search_results` بعد deduplication للـURL.
- كل نتيجة تحصل على `source_evidence` يوضح query category، الترتيب، المصدر ووقت الجمع.
- النتائج لا تدخل في `overallConfidence` لأنها **retrieval evidence** وليست إثبات هوية.
- إذا المفتاح غير موجود أو رفضه المصدر أو حصل rate limit، يتم التخطي/التسجيل بدون توليد findings وهمية.

### 3. Passive Infrastructure Enrichment

بعد Domain Intelligence، التطبيق يشتق فقط الـdomain الحقيقي وعناوين A/AAAA التي ظهرت في DNS، ثم يشغل enrichment سلبيًا. لا يوجد port scanning من الجهاز ولا submission تلقائي لمواقع خارجية.

المصادر المبنية داخل الأداة بدون مفتاح:

- **Internet Archive / Wayback CDX**: captures تاريخية للـdomain مع timestamp/original URL/status/MIME/digest عندما تكون متاحة.
- **IP RDAP**: بيانات تسجيل الـpublic IP مثل allocation name/type/country/range/CIDR.

المصادر الاختيارية بمفتاح مخزن عبر `safeStorage`:

- **urlscan.io Search API**: يبحث في scans الموجودة مسبقًا فقط. الأداة لا تنشئ public scan تلقائيًا.
- **VirusTotal API v3**: domain reputation، analysis stats، categories/tags والتواريخ المتاحة. التكامل read-only ولا يرفع ملفات أو URLs للتحليل.
- **Shodan Host API**: يقرأ host/services الموجودة في فهرس Shodan باستخدام `minify=true`. لا يستخدم scan/alert/monitor endpoints ولا يحفظ raw banners.

قبل IP RDAP أو Shodan، تتم فلترة private/link-local/documentation/multicast/reserved IPs. النتائج تحفظ ضمن `search_results` مع `source_evidence` خاص بكل مزود، لكنها تبقى **infrastructure context** ولا تدخل في احتمال الهوية أو إثبات الملكية/التحكم.

### 4. Extended Username Search

اختياري من الواجهة:

- **Sherlock** إذا كان مثبتًا محليًا ومتاحًا في `PATH`.
- **Maigret** إذا كان مثبتًا محليًا ومتاحًا في `PATH`.

التطبيق يفحص توفر الأداتين تلقائيًا. التنفيذ يستخدم subprocess بدون shell command strings، مع validation للـusername وtimeout وحدود لحجم المخرجات. Maigret يُقرأ من تقرير `simple JSON` machine-readable بدل تحليل console text. يتم deduplicate للروابط قبل إضافتها إلى الحالة.

هذه النتائج تحتاج تحققًا يدويًا لأن أدوات username enumeration نفسها قد تنتج false positives.

### 5. Breach Intelligence

- **Have I Been Pwned API v3** عند ضبط API key صالح.
- لا يتم إنشاء أي breach records عند عدم وجود المفتاح.
- كل سجل محفوظ يملك provenance يوضح أن المصدر هو HIBP ونوع السجل ووقت الملاحظة وجودة الدليل.
- المفتاح يُخزن عبر Electron `safeStorage` ولا يُعاد إلى renderer بعد الحفظ. على Linux يتم رفض backend من نوع `basic_text`.

### 6. Domain Intelligence

للنطاق المشتق من بريد غير استهلاكي، التطبيق يجمع عدة مصادر مستقلة بالتوازي:

- **RDAP** لبيانات التسجيل المتاحة للعامة.
- **Google Public DNS DoH** للسجلات `A`, `AAAA`, `MX`, `NS`, `TXT`, `CAA` و`_dmarc`.
- تحليل **SPF / DMARC** من DNS الحقيقي.
- **Certificate Transparency** best-effort لاستخراج أسماء ظهرت في شهادات عامة.

إذا تعطل مصدر واحد لا تُرمى بقية النتائج؛ يتم حفظ حالة كل مصدر داخل record. نطاقات Gmail/Outlook/Proton وغيرها يتم تخطيها لأن بنية النطاق لا تكون دليلًا متعلقًا بصاحب البريد الفردي.

### 7. Evidence Provenance

كل حالة تملك جدول `source_evidence` منفصلًا. سجل الدليل يحتوي على:

- اسم المصدر ونوعه
- نوع الكيان ورقمه
- نوع الملاحظة / evidence method
- رابط المصدر عند توفره
- وقت الجمع
- Evidence Quality من 0 إلى 100
- metadata خاصة بالمصدر

يوجد تبويب **Evidence** داخل التطبيق، كما يتم تضمين السجلات نفسها في JSON وHTML export. عند فتح بيانات أقدم، يقوم Evidence Recorder بإنشاء provenance فقط عندما يستطيع استنتاج المصدر من metadata المحفوظة؛ لا يتم اختلاق مصدر لسجل مجهول.

### 8. Correlation

Correlation Engine يربط البيانات بعد جمعها، لكنه لا يعتبر درجات التشابه احتمالات هوية.

- تطابق username = علاقة "مطابقة اسم مستخدم".
- ظهور البريد في HIBP = علاقة "البريد ظهر في".
- domain المستخرج من البريد = "نطاق البريد"، وليس "يملك النطاق".
- تشابه اسم/bio/avatar بين حسابين = **attribute similarity** فقط.
- Search/Archive/Threat Intel/Host Index results لا تدخل في aggregate confidence.

`overallConfidence` في التقرير يعني Aggregate Evidence Quality للمصادر التي تدعم entity records، وليس probability أن الشخص هو صاحب كل الحسابات.

### 9. Local Image Analyzer

يوجد قسم **الأدوات** داخل الواجهة وزر **تحليل صورة محلية** داخل تقرير الحالة.

- اختيار الملف يتم من OS file picker داخل Electron main process؛ renderer لا يملك filesystem access مباشر.
- SHA-256 حقيقي للملف.
- حجم وامتداد وتاريخ تعديل.
- EXIF حقيقي عبر **ExifTool** إذا كان مثبتًا.
- camera/image/capture/GPS metadata عندما تكون موجودة.
- لا يقبل remote image URLs ولا يرفع صور المستخدم تلقائيًا لخدمات خارجية.
- إذا تم التحليل ضمن حالة، يتم حفظ `urn:sha256:<hash>` والـmetadata فقط؛ لا يتم حفظ مسار الملف أو image bytes.
- التحليل خارج حالة لا ينشئ orphan database logs/evidence.

## أدوات معطلة عمدًا

بعض الملفات القديمة ما زالت موجودة للتوافق، لكن المسارات المضللة أُوقفت:

- **Face / reverse-image search**: ترجع `unavailable` بدون أي نتيجة حتى يتم دمج provider حقيقي ومرخّص وقابل للتدقيق.
- **Holehe-style account recovery enumeration**: معطل لأن إشارات recovery/rate-limit ليست دليلًا ثابتًا بما يكفي للتقارير التجارية.
- **Search-result HTML scraping**: معطل. Web Search الآلي يمر عبر Search API منظم.
- **Active URL/host scanning** من urlscan/Shodan: غير مستخدم تلقائيًا في مسار الحالة الحالي؛ integrations الجديدة passive/read-only.
- أي module يستخدم `Math.random()` أو synthetic result URLs كدليل يجب أن يفشل regression tests.

راجع [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) لعقد كل مصدر بالتفصيل.

## إدارة الحالات والتصدير

- SQLite داخل مجلد بيانات التطبيق الخاص بالمستخدم.
- حذف الحالة بتأكيد على مرحلتين مع حذف transactional للبيانات التابعة وEvidence records.
- JSON export schema **1.2** يتضمن profiles، breaches، domain intel، discovery/enrichment، `media[]`، graph، logs، `evidence[]` وprovenance.
- HTML export ذاتي الاحتواء وبدون JavaScript مع CSP وescaping للبيانات الخارجية.
- لا يتم تضمين image bytes أو local file paths في التصدير.

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
- HIBP وBrave وurlscan وVirusTotal وShodan API keys تبقى في main process بعد تخزينها الآمن
- private/reserved IP filtering قبل أي third-party IP enrichment

## المتطلبات

- Node.js 22 أو أحدث للتطوير
- npm
- نظام سطح مكتب مدعوم من Electron
- اختياري: HIBP API key
- اختياري: Brave Search API key
- اختياري: urlscan.io API key
- اختياري: VirusTotal API key
- اختياري: Shodan API key
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
- Brave Search query budget / URL normalization / dedup / provenance
- RDAP وDNS/SPF/DMARC parsing
- Wayback CDX parsing
- urlscan historical scan mapping + منع submission endpoint
- VirusTotal domain reputation mapping
- IP RDAP public/reserved filtering
- Shodan minified host mapping + منع active scan endpoints/raw banner persistence
- Sherlock parser وinput validation
- Maigret simple JSON parsing
- HIBP schema mapping
- Local Image Analyzer وعدم توليد remote/fabricated evidence
- Evidence provenance persistence/backfill/delete
- report export + XSS escaping + provenance
- منع fabricated evidence و`Math.random()` في modules الحساسة
- Electron security configuration وcredential isolation

CI يبني `better-sqlite3` أولًا لـNode ABI حتى تعمل اختبارات قاعدة البيانات، ثم يتحقق من Electron native dependency rebuild بشكل منفصل.

## الخصوصية والاستخدام

البيانات الخاصة بالحالات محفوظة محليًا. كل مصدر خارجي يستقبل فقط identifier/query/domain/public IP اللازمة للاستعلام الخاص به. عند تفعيل مزود بمفتاح، التطبيق يوضح جاهزيته في الواجهة ولا يعيد السر نفسه إلى renderer.

الأداة مخصصة للاستخدامات المصرح بها والمشروعة مثل البحث الأمني، التحقيقات المصرح بها، due diligence، والتحقق من المعلومات العامة. وجود username أو email أو domain أو archive/search/host record في مصدر عام لا يثبت وحده هوية الشخص أو ملكيته للحساب أو النطاق أو الشبكة. يجب إجراء تحقق بشري قبل استخدام النتيجة في قرار أو استنتاج رسمي.

## ما ينقص قبل Release تجاري نهائي

- توقيع وnotarization للملفات التنفيذية
- نظام تحديث آمن
- migrations versioned لقاعدة البيانات
- E2E + accessibility tests
- native PDF export
- provider abstraction أعمق مع budgets/rate policies قابلة للضبط
- image magic-byte validation وتحليل صور محلي أعمق
- crash reporting اختياري ويحافظ على الخصوصية
- screenshots ووثائق إصدار ودعم واضحة

## الترخيص

MIT للمشروع. الخدمات الخارجية لها شروط استخدام وسياسات rate limits منفصلة ويجب الالتزام بها.

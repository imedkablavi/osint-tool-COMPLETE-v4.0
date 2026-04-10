# 🚀 الميزات المتقدمة - OSINT Tool v2.0

## نظرة عامة

تم تطوير OSINT Tool بإضافة ميزات متقدمة شاملة تجعله أداة احترافية كاملة للتحقيقات الرقمية. جميع الميزات **فعلية وليست محاكاة**.

---

## 📦 الوحدات الجديدة

### 1. أدوات OSINT الحقيقية

#### Sherlock Collector
- **الوصف**: دمج حقيقي مع أداة Sherlock للبحث في 400+ موقع
- **الملف**: `src/modules/sherlockCollector.js`
- **الاستخدام**:
```javascript
const sherlock = new SherlockCollector(db);
await sherlock.collect(personId, { username: 'target_user' });
```
- **المميزات**:
  - بحث سريع في 400+ موقع
  - تصدير JSON
  - مستوى ثقة عالي (85%)
  - دعم TOR

#### Maigret Collector
- **الوصف**: نسخة موسعة من Sherlock للبحث في 3000+ موقع
- **الملف**: `src/modules/maigretCollector.js`
- **الاستخدام**:
```javascript
const maigret = new MaigretCollector(db);
await maigret.collect(personId, { username: 'target_user' });
```
- **المميزات**:
  - بحث معمق في 3000+ موقع
  - استخراج معلومات إضافية (الاسم، الموقع، المتابعين)
  - بحث متكرر (Recursive)
  - تقارير HTML/PDF/JSON

#### Holehe Collector
- **الوصف**: التحقق من البريد الإلكتروني في 120+ موقع
- **الملف**: `src/modules/holeheCollector.js`
- **الاستخدام**:
```javascript
const holehe = new HoleheCollector(db);
await holehe.collect(personId, { email: 'target@example.com' });
```
- **المميزات**:
  - التحقق عبر "نسيت كلمة المرور"
  - 120+ موقع مدعوم
  - سريع وفعال

#### HaveIBeenPwned Collector
- **الوصف**: فحص التسريبات الأمنية عبر API الحقيقي
- **الملف**: `src/modules/hibpCollector.js`
- **الاستخدام**:
```javascript
const hibp = new HIBPCollector(db, 'YOUR_API_KEY');
await hibp.collect(personId, { email: 'target@example.com' });
```
- **المميزات**:
  - API رسمي من HaveIBeenPwned
  - فحص التسريبات والـ Pastes
  - معلومات مفصلة عن كل تسريب

#### Google Dorks Collector
- **الوصف**: نظام بحث متقدم باستخدام Google Dorks
- **الملف**: `src/modules/googleDorksCollector.js`
- **الاستخدام**:
```javascript
const dorks = new GoogleDorksCollector(db);
await dorks.collect(personId, searchData);
```
- **المميزات**:
  - قوالب Dorks جاهزة
  - بحث متقدم في الملفات والوثائق
  - اكتشاف معلومات مخفية

---

### 2. تحليل الصور والوسائط

#### Image Analyzer
- **الوصف**: تحليل شامل للصور مع استخراج EXIF والبحث العكسي
- **الملف**: `src/modules/imageAnalyzer.js`
- **الاستخدام**:
```javascript
const analyzer = new ImageAnalyzer(db);
const results = await analyzer.analyzeImage(personId, imageUrl);
```
- **المميزات**:
  - **استخراج EXIF**:
    - معلومات الكاميرا (الطراز، الشركة)
    - الموقع الجغرافي (GPS)
    - التاريخ والوقت
    - الإعدادات التقنية (ISO, Exposure, F-Number)
  - **البحث العكسي**:
    - Google Reverse Image Search
    - Yandex Reverse Image Search
  - **معالجة تلقائية**:
    - تحميل الصور من URLs
    - تحليل تلقائي
    - حفظ النتائج

---

### 3. تحليل النصوص المتقدم

#### Stylometry Analyzer
- **الوصف**: تحليل أسلوب الكتابة لتحديد هوية الكاتب
- **الملف**: `src/modules/stylometryAnalyzer.js`
- **الاستخدام**:
```javascript
const stylometry = new StylometryAnalyzer(db);
const analysis = await stylometry.analyzeText(personId, text, source);
```
- **الميزات المستخرجة**:
  - **تحليل الأحرف**: نسب الأحرف الكبيرة/الصغيرة، الأرقام
  - **تحليل الكلمات**: متوسط الطول، الكلمات الفريدة
  - **تحليل الجمل**: متوسط طول الجمل
  - **علامات الترقيم**: كثافة الاستخدام
  - **المفردات**: ثراء المفردات، الكلمات الأكثر استخداماً
  - **الأسلوب**: درجة الرسمية، الكلمات الانتقالية

- **البصمة الأسلوبية**:
```javascript
{
  avg_word_length: 5.2,
  avg_sentence_length: 15.8,
  unique_word_ratio: 0.65,
  punctuation_density: 0.08,
  function_word_ratio: 0.35,
  formality: 72
}
```

- **المقارنة**:
```javascript
const similarity = stylometry.compareFingerprints(fingerprint1, fingerprint2);
// { similarity: 85, confidence: 'عالي' }
```

---

### 4. رسم العلاقات التفاعلي

#### vis.js Network Graph
- **الوصف**: رسم بياني تفاعلي متقدم للعلاقات
- **الملف**: `src/renderer/graph-viewer.html`
- **المميزات**:
  - **تفاعلي كامل**: تكبير، تصغير، سحب، تحريك
  - **أنواع تخطيط**:
    - فيزيائي (Physics-based)
    - هرمي (Hierarchical)
    - دائري (Circular)
  - **فلاتر متقدمة**:
    - تصفية حسب المنصة
    - تصفية حسب مستوى الثقة
    - تصفية حسب نوع العلاقة
  - **معلومات تفصيلية**: عند النقر على أي عقدة
  - **إحصائيات مباشرة**: عدد العقد، العلاقات، المنصات
  - **ألوان مميزة**: لكل نوع من الكيانات

---

### 5. التحسينات الأمنية

#### Cache Manager
- **الوصف**: نظام Cache ذكي لتقليل الطلبات
- **الملف**: `src/utils/cacheManager.js`
- **الاستخدام**:
```javascript
const cache = new CacheManager();

// حفظ في Cache
cache.set('key', data, ttl);

// استرجاع من Cache
const data = cache.get('key');

// Cache مع fallback
const data = await cache.remember('key', async () => {
  return await fetchData();
}, ttl);
```
- **المميزات**:
  - TTL قابل للتخصيص
  - تنظيف تلقائي للـ Cache المنتهي
  - إحصائيات Cache
  - دعم JSON

#### Proxy Manager
- **الوصف**: إدارة Proxy وTor للطلبات الحساسة
- **الملف**: `src/utils/proxyManager.js`
- **الاستخدام**:
```javascript
const proxy = new ProxyManager();

// تفعيل Tor
proxy.enableTor();
await proxy.testTorConnection();

// تفعيل Proxy
proxy.enableProxy('http://proxy:port');
await proxy.testProxy(proxyUrl);

// إجراء طلب عبر Proxy/Tor
const response = await proxy.request(url);
```
- **المميزات**:
  - دعم Tor (SOCKS5)
  - دعم HTTP/HTTPS Proxy
  - اختبار الاتصال
  - تدوير Proxy تلقائي
  - الحصول على IP الحالي

#### Encryption Manager
- **الوصف**: نظام تشفير AES-256-GCM للبيانات الحساسة
- **الملف**: `src/utils/encryptionManager.js`
- **الاستخدام**:
```javascript
const encryption = new EncryptionManager();

// تشفير نص
const encrypted = encryption.encrypt('sensitive data');

// فك تشفير
const decrypted = encryption.decrypt(encrypted);

// تشفير ملف
encryption.encryptFile(inputPath, outputPath);

// تشفير قاعدة البيانات
encryption.encryptDatabase(dbPath);
```
- **المميزات**:
  - خوارزمية AES-256-GCM
  - مفتاح رئيسي محمي
  - Authentication Tag
  - تشفير الملفات وقواعد البيانات
  - Hash آمن مع Salt

---

### 6. نظام التصدير الشامل

#### Export Manager
- **الوصف**: تصدير التقارير بصيغ متعددة
- **الملف**: `src/utils/exportManager.js`
- **الاستخدام**:
```javascript
const exporter = new ExportManager(db);

// تصدير بجميع الصيغ
const results = await exporter.exportInvestigation(personId, ['json', 'csv', 'pdf']);
```

#### صيغ التصدير

**1. JSON**
- بيانات منظمة وكاملة
- سهل التحليل والمعالجة
- يحتوي على جميع التفاصيل

**2. CSV**
- جداول منظمة
- سهل الفتح في Excel
- مناسب للتحليل الإحصائي

**3. PDF**
- تقرير احترافي
- تنسيق HTML جميل
- جاهز للطباعة والمشاركة
- يحتوي على:
  - معلومات الشخص
  - الحسابات الاجتماعية
  - التسريبات الأمنية
  - النطاقات
  - شبكة العلاقات
  - الإحصائيات

---

## 🔧 التثبيت والإعداد

### المتطلبات الإضافية

```bash
# تثبيت أدوات Python
sudo pip3 install sherlock-project maigret holehe exifread

# تثبيت مكتبات Node.js
npm install vis-network vis-data socks-proxy-agent

# (اختياري) لتصدير PDF
sudo apt-get install wkhtmltopdf
# أو
sudo pip3 install weasyprint
```

### إعداد Tor (اختياري)

```bash
# تثبيت Tor
sudo apt-get install tor

# تشغيل Tor
sudo systemctl start tor

# التحقق من الحالة
sudo systemctl status tor
```

### إعداد HaveIBeenPwned API

1. احصل على API Key من: https://haveibeenpwned.com/API/Key
2. أضف المفتاح في الإعدادات

---

## 📊 سير العمل المحسّن

### 1. بدء تحقيق جديد

```
المستخدم يدخل البيانات
    ↓
البحث الأساسي (SocialMediaCollector)
    ↓
Sherlock (400+ موقع) - سريع
    ↓
Holehe (التحقق من البريد)
    ↓
HaveIBeenPwned (فحص التسريبات)
    ↓
Google Dorks (بحث متقدم)
    ↓
Maigret (3000+ موقع) - معمق (اختياري)
    ↓
تحليل العلاقات
    ↓
توليد التقرير
```

### 2. تحليل الصور

```
رفع صورة أو URL
    ↓
تحميل الصورة
    ↓
استخراج EXIF (GPS, Camera, Date)
    ↓
البحث العكسي (Google + Yandex)
    ↓
حفظ النتائج
```

### 3. تحليل النصوص

```
إدخال نص
    ↓
استخراج الميزات الأسلوبية
    ↓
إنشاء بصمة أسلوبية
    ↓
مقارنة مع نصوص أخرى (اختياري)
    ↓
حفظ التحليل
```

---

## 🎯 حالات الاستخدام

### 1. تحقيق شامل

```javascript
// بدء تحقيق مع جميع الأدوات
const searchData = {
  fullname: 'John Doe',
  email: 'john@example.com',
  username: 'johndoe',
  phone: '+1234567890',
  deepSearch: true // تفعيل Maigret
};

await ipcRenderer.invoke('start-investigation', searchData);
```

### 2. التحقق من البريد فقط

```javascript
const holehe = new HoleheCollector(db);
const hibp = new HIBPCollector(db, apiKey);

await holehe.collect(personId, { email });
await hibp.collect(personId, { email });
```

### 3. تحليل صورة من حساب اجتماعي

```javascript
const imageUrl = 'https://example.com/profile.jpg';
const results = await analyzer.analyzeImage(personId, imageUrl);

console.log('GPS:', results.exif.location);
console.log('Camera:', results.exif.camera);
console.log('Reverse Search:', results.reverseSearch);
```

### 4. مقارنة أساليب كتابة

```javascript
const text1 = "نص من مصدر 1...";
const text2 = "نص من مصدر 2...";

const analysis1 = await stylometry.analyzeText(personId, text1, 'source1');
const analysis2 = await stylometry.analyzeText(personId, text2, 'source2');

const comparison = stylometry.compareFingerprints(
  analysis1.fingerprint,
  analysis2.fingerprint
);

console.log(`التشابه: ${comparison.similarity}%`);
console.log(`الثقة: ${comparison.confidence}`);
```

---

## 🔐 الأمان والخصوصية

### 1. تشفير قاعدة البيانات

```javascript
// تشفير
const encryptedPath = encryption.encryptDatabase(dbPath);

// فك التشفير
encryption.decryptDatabase(encryptedPath, dbPath);
```

### 2. استخدام Tor

```javascript
// تفعيل Tor
proxy.enableTor();

// التحقق من الاتصال
const isWorking = await proxy.testTorConnection();

// جميع الطلبات ستمر عبر Tor تلقائياً
```

### 3. Cache آمن

```javascript
// Cache يُخزن محلياً فقط
// يمكن مسحه في أي وقت
cache.clear();
```

---

## 📈 الإحصائيات والأداء

### مقارنة الأدوات

| الأداة | عدد المواقع | السرعة | مستوى الثقة |
|--------|-------------|---------|-------------|
| Sherlock | 400+ | سريع (1-2 دقيقة) | 85% |
| Maigret | 3000+ | بطيء (5-10 دقائق) | 80% |
| Holehe | 120+ | سريع (30 ثانية) | 90% |
| HIBP | N/A | سريع (5 ثوان) | 95% |
| Google Dorks | N/A | متوسط (1-3 دقائق) | 70% |

### استهلاك الموارد

- **الذاكرة**: 200-500 MB
- **المعالج**: متوسط أثناء البحث
- **الشبكة**: يعتمد على عدد الأدوات المفعلة
- **التخزين**: 
  - قاعدة البيانات: 10-100 MB
  - Cache: 50-200 MB
  - الصور المؤقتة: 10-50 MB

---

## 🐛 استكشاف الأخطاء

### 1. Sherlock/Maigret لا يعمل

```bash
# تأكد من التثبيت
pip3 show sherlock-project
pip3 show maigret

# إعادة التثبيت
sudo pip3 install --upgrade sherlock-project maigret
```

### 2. Tor لا يتصل

```bash
# التحقق من حالة Tor
sudo systemctl status tor

# إعادة تشغيل Tor
sudo systemctl restart tor

# التحقق من المنفذ
netstat -an | grep 9050
```

### 3. فشل تصدير PDF

```bash
# تثبيت wkhtmltopdf
sudo apt-get install wkhtmltopdf

# أو استخدام Python
sudo pip3 install weasyprint
```

### 4. خطأ في EXIF

```bash
# تثبيت exifread
sudo pip3 install exifread pillow
```

---

## 📝 ملاحظات مهمة

### الاستخدام الأخلاقي
⚠️ **جميع هذه الأدوات للأغراض التعليمية والبحثية والتحقيقات المشروعة فقط**

### القيود القانونية
- احترم قوانين الخصوصية في بلدك
- لا تستخدم الأداة لأغراض غير قانونية
- احترم شروط استخدام المواقع

### الحدود التقنية
- بعض المواقع قد تحظر الطلبات الآلية
- CAPTCHA قد يمنع بعض عمليات البحث
- Rate Limiting قد يبطئ العمليات

---

## 🚀 التطويرات المستقبلية

- [ ] دمج PhoneInfoga لتحليل أرقام الهاتف
- [ ] دمج GHunt لحسابات Google
- [ ] تحليل الفيديوهات
- [ ] التعرف على الوجوه
- [ ] تحليل الشبكات الاجتماعية
- [ ] Machine Learning للتصنيف
- [ ] واجهة ويب
- [ ] API REST

---

## 📞 الدعم

للمساعدة والدعم:
- راجع الوثائق الكاملة في `README.md`
- راجع الأمثلة في `SUGGESTIONS.md`
- افتح Issue على GitHub

---

**تم بناء هذه الميزات بشكل كامل وفعلي - جاهزة للاستخدام الفوري!** ✅

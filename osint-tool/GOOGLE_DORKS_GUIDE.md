# 🔍 دليل Google Dorks المتقدم - OSINT Tool v2.1

دليل شامل لنظام Google Dorks المتقدم مع خوارزميات ذكية لتوليد الاستعلامات تلقائياً.

---

## 📋 المحتويات

1. [مقدمة](#مقدمة)
2. [ما هو Google Dorks؟](#ما-هو-google-dorks)
3. [العوامل المدعومة](#العوامل-المدعومة)
4. [الخوارزمية الذكية](#الخوارزمية-الذكية)
5. [أمثلة عملية](#أمثلة-عملية)
6. [الاستخدام البرمجي](#الاستخدام-البرمجي)
7. [أفضل الممارسات](#أفضل-الممارسات)

---

## 🎯 مقدمة

نظام **Google Dorks المتقدم** هو محرك بحث ذكي يستخدم ميزات البحث المتقدم في Google للعثور على معلومات دقيقة ومحددة. النظام **قانوني 100%** ولا يتجاوز أي إجراءات قانونية، بل يستخدم الميزات العامة المتاحة للجميع.

### ✅ الميزات الرئيسية

- **توليد تلقائي**: يولد مئات الاستعلامات الذكية من بيانات بسيطة
- **خوارزمية ذكية**: ترتيب الاستعلامات حسب الأولوية والصلة
- **تحليل متقدم**: تصنيف وتحليل النتائج تلقائياً
- **دمج كامل**: يحفظ النتائج في قاعدة البيانات مباشرة
- **283+ استعلام**: من بيانات شخص واحد فقط!

---

## 🔎 ما هو Google Dorks؟

**Google Dorking** (أو Google Hacking) هي تقنية استخدام عوامل البحث المتقدم في Google للعثور على معلومات محددة بدقة عالية.

### مثال بسيط

بدلاً من البحث عن:
```
john smith email
```

يمكنك استخدام:
```
"john smith" (email OR contact) site:linkedin.com
```

هذا يعطي نتائج أكثر دقة وتحديداً!

---

## 🛠️ العوامل المدعومة

النظام يدعم جميع عوامل Google المتقدمة:

### 1. عوامل الموقع

| العامل | الوصف | مثال |
|--------|-------|------|
| `site:` | البحث داخل موقع محدد | `site:facebook.com "john smith"` |
| `related:` | مواقع مشابهة | `related:linkedin.com` |
| `info:` | معلومات عن موقع | `info:example.com` |
| `link:` | روابط تشير للموقع | `link:example.com` |

### 2. عوامل الملفات

| العامل | الوصف | مثال |
|--------|-------|------|
| `filetype:` | نوع الملف | `"john smith" filetype:pdf` |
| `ext:` | امتداد الملف (مرادف) | `"resume" ext:docx` |

**الأنواع المدعومة**: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV, ZIP, RAR

### 3. عوامل المحتوى

| العامل | الوصف | مثال |
|--------|-------|------|
| `intitle:` | في العنوان | `intitle:"john smith"` |
| `allintitle:` | جميع الكلمات في العنوان | `allintitle: john smith profile` |
| `inurl:` | في الرابط | `inurl:profile inurl:johnsmith` |
| `allinurl:` | جميع الكلمات في الرابط | `allinurl: user johnsmith` |
| `intext:` | في النص | `intext:"john.smith@example.com"` |
| `allintext:` | جميع الكلمات في النص | `allintext: john smith email` |
| `inanchor:` | في نص الرابط | `inanchor:"john smith"` |

### 4. العوامل المنطقية

| العامل | الوصف | مثال |
|--------|-------|------|
| `AND` | كلا الشرطين | `"john" AND "smith"` |
| `OR` أو `\|` | أحد الشرطين | `"john" OR "jonathan"` |
| `-` | استبعاد | `"john smith" -site:facebook.com` |
| `" "` | مطابقة تامة | `"john smith"` |
| `*` | Wildcard | `"john*@gmail.com"` |
| `( )` | تجميع | `("john" OR "jonathan") AND "smith"` |

---

## 🧠 الخوارزمية الذكية

النظام يستخدم خوارزمية متقدمة لتوليد الاستعلامات تلقائياً:

### 1. التحليل الأولي

```javascript
Input: {
  fullName: "John Smith",
  email: "john.smith@example.com",
  username: "johnsmith",
  phone: "+1-555-123-4567",
  location: "New York"
}
```

### 2. التوليد الذكي

النظام يولد استعلامات في 6 فئات:

#### أ) استعلامات أساسية (73 استعلام)
```
"John Smith"
"John Smith" "New York"
"John Smith" AND "Software Engineer"
"John" "Smith"
```

#### ب) المنصات الاجتماعية (43 استعلام)
```
site:facebook.com "John Smith"
site:twitter.com "johnsmith"
site:instagram.com intitle:"John Smith"
site:linkedin.com "john.smith@example.com"
```

#### ج) المنصات المهنية (19 استعلام)
```
site:linkedin.com "John Smith"
site:github.com "johnsmith"
site:stackoverflow.com "johnsmith"
"John Smith" (CV OR resume) filetype:pdf
```

#### د) البحث عن الوثائق (15 استعلام)
```
"John Smith" filetype:pdf
"john.smith@example.com" filetype:docx
"John Smith" (invoice OR receipt) filetype:pdf
```

#### هـ) مواقع التسريبات (2 استعلام)
```
site:pastebin.com "john.smith@example.com"
"john.smith@example.com" (leak OR breach OR dump)
```

#### و) استعلامات مركبة (90 استعلام)
```
"John Smith" AND "john.smith@example.com"
("John Smith" OR "johnsmith") AND "New York"
"John Smith" -site:linkedin.com
```

### 3. الترتيب حسب الأولوية

```
الأولوية 1: استعلامات مباشرة
الأولوية 2: منصات اجتماعية
الأولوية 3: مواقع تسريبات
الأولوية 4: وثائق
الأولوية 5: باقي الاستعلامات
```

### 4. التحليل والتصنيف

كل نتيجة يتم تحليلها وتصنيفها:

```javascript
{
  title: "John Smith - Software Engineer",
  url: "https://linkedin.com/in/johnsmith",
  snippet: "...",
  category: "professional",      // social_media, professional, leak, forum, document
  relevance: 8,                   // 0-10
  platform: "linkedin.com",
  fileType: null,
  timestamp: "2024-12-03T10:30:00Z"
}
```

---

## 💡 أمثلة عملية

### مثال 1: البحث عن شخص

**البيانات**:
```
الاسم: محمد أحمد
الموقع: القاهرة
المهنة: مهندس برمجيات
```

**الاستعلامات المولدة**:
```
"محمد أحمد"
"محمد أحمد" "القاهرة"
"محمد أحمد" "مهندس برمجيات"
site:linkedin.com "محمد أحمد"
site:facebook.com "محمد أحمد"
"محمد أحمد" (CV OR resume) filetype:pdf
```

### مثال 2: البحث عن بريد إلكتروني

**البيانات**:
```
البريد: ahmed@example.com
```

**الاستعلامات المولدة**:
```
"ahmed@example.com"
intext:"ahmed@example.com"
site:pastebin.com "ahmed@example.com"
"ahmed@example.com" (leak OR breach)
"ahmed@example.com" filetype:pdf
"ahmed"*@example.com
*@example.com
```

### مثال 3: البحث عن اسم مستخدم

**البيانات**:
```
اسم المستخدم: ahmed_dev
```

**الاستعلامات المولدة**:
```
"ahmed_dev"
inurl:"ahmed_dev"
site:github.com "ahmed_dev"
site:twitter.com "ahmed_dev"
site:reddit.com "ahmed_dev"
site:stackoverflow.com "ahmed_dev"
```

### مثال 4: البحث عن رقم هاتف

**البيانات**:
```
الهاتف: +1-555-123-4567
```

**التنسيقات المولدة**:
```
"+1-555-123-4567"
"15551234567"
"+15551234567"
"(155) 512-34567"
"155-512-34567"
"155.512.34567"
```

**الاستعلامات**:
```
"+1-555-123-4567"
intext:"+1-555-123-4567"
"+1-555-123-4567" (business OR company)
"+1-555-123-4567" filetype:pdf
site:facebook.com "+1-555-123-4567"
```

---

## 💻 الاستخدام البرمجي

### التثبيت

```bash
cd /home/ubuntu/osint-tool
npm install
```

### الاستخدام الأساسي

```javascript
const AdvancedGoogleDorksEngine = require('./src/modules/advancedGoogleDorks');
const Database = require('./src/database/schema');

// تهيئة
const db = new Database('./data/osint.db');
const dorksEngine = new AdvancedGoogleDorksEngine(db);

// بيانات الشخص
const personData = {
  fullName: 'John Smith',
  email: 'john.smith@example.com',
  username: 'johnsmith',
  phone: '+1-555-123-4567',
  location: 'New York'
};

// توليد الاستعلامات فقط
const queries = dorksEngine.generateSmartQueries(personData);
console.log(`تم توليد ${queries.length} استعلام`);

// البحث الكامل (مع استخراج النتائج)
const results = await dorksEngine.search(personId, personData, {
  maxQueries: 50,           // عدد الاستعلامات
  maxResultsPerQuery: 10,   // نتائج لكل استعلام
  delay: 2000,              // تأخير بين الاستعلامات (ملي ثانية)
  useProxy: false           // استخدام Proxy
});

console.log(`النتائج: ${results.totalResults}`);
```

### استخدام متقدم

```javascript
// توليد استعلامات البريد فقط
const emailQueries = dorksEngine.generateEmailQueries('test@example.com');

// توليد استعلامات اسم المستخدم فقط
const usernameQueries = dorksEngine.generateUsernameQueries('johnsmith');

// توليد استعلامات الهاتف فقط
const phoneQueries = dorksEngine.generatePhoneQueries('+1-555-123-4567');

// استعلامات مركبة
const combinedQueries = dorksEngine.generateCombinedQueries(personData);

// تنسيق رقم الهاتف
const phoneFormats = dorksEngine.formatPhoneNumber('+1-555-123-4567');
```

---

## ⚡ أفضل الممارسات

### 1. احترم القوانين

✅ **استخدامات قانونية**:
- البحث عن معلومات عامة
- التحقيقات المشروعة
- البحث الأكاديمي
- الأمن السيبراني (بإذن)

❌ **استخدامات غير قانونية**:
- التجسس غير المصرح به
- انتهاك الخصوصية
- الابتزاز أو التهديد
- سرقة الهوية

### 2. استخدم التأخير

```javascript
// ❌ سيء: بدون تأخير (قد يؤدي للحظر)
await dorksEngine.search(personId, personData, { delay: 0 });

// ✅ جيد: مع تأخير مناسب
await dorksEngine.search(personId, personData, { delay: 2000 });
```

### 3. استخدم Proxy عند الحاجة

```javascript
const ProxyManager = require('./src/utils/proxyManager');
const proxyManager = new ProxyManager();

// تفعيل Tor
proxyManager.useTor();

// استخدام مع Google Dorks
const dorksEngine = new AdvancedGoogleDorksEngine(db, proxyManager);
```

### 4. استخدم Cache

```javascript
const CacheManager = require('./src/utils/cacheManager');
const cacheManager = new CacheManager();

const dorksEngine = new AdvancedGoogleDorksEngine(db, null, cacheManager);

// النتائج ستُحفظ في Cache تلقائياً
```

### 5. حدد عدد الاستعلامات

```javascript
// ❌ سيء: استعلامات كثيرة جداً
const queries = allQueries; // 283 استعلام!

// ✅ جيد: عدد معقول
const queries = allQueries.slice(0, 50); // 50 استعلام فقط
```

---

## 📊 الإحصائيات

### من بيانات شخص واحد

| الفئة | العدد |
|------|-------|
| **إجمالي الاستعلامات** | 283 |
| استعلامات أساسية | 73 |
| منصات اجتماعية | 43 |
| منصات مهنية | 19 |
| وثائق | 15 |
| مواقع تسريبات | 2 |
| استعلامات مركبة | 90 |
| استعلامات موقع محدد (site:) | 195 |
| استعلامات نوع ملف (filetype:) | 15 |
| استعلامات متقدمة (AND/OR/-) | 90 |

### تنسيقات رقم الهاتف

من رقم واحد: **6 تنسيقات مختلفة**

### استعلامات البريد الإلكتروني

من بريد واحد: **38 استعلام متخصص**

### استعلامات اسم المستخدم

من اسم مستخدم واحد: **76 استعلام**

---

## 🔗 روابط مفيدة

- [Google Search Operators](https://support.google.com/websearch/answer/2466433)
- [Google Hacking Database (GHDB)](https://www.exploit-db.com/google-hacking-database)
- [OSINT Framework](https://osintframework.com/)

---

## ⚠️ إخلاء المسؤولية

هذه الأداة مخصصة **للأغراض التعليمية والبحثية والتحقيقات المشروعة فقط**. المطورون غير مسؤولين عن أي استخدام غير قانوني أو غير أخلاقي للأداة.

**استخدم بمسؤولية واحترم خصوصية الآخرين!**

---

## 📝 الخلاصة

نظام Google Dorks المتقدم هو أداة قوية ومرنة للبحث الذكي عن المعلومات. مع خوارزمية التوليد التلقائي، يمكنك توليد مئات الاستعلامات المتخصصة من بيانات بسيطة، مما يوفر عليك ساعات من العمل اليدوي.

**النسخة**: 2.1.0  
**التاريخ**: ديسمبر 2024  
**الحالة**: ✅ جاهز للإنتاج

---

**🚀 ابدأ الآن واكتشف قوة Google Dorks!**

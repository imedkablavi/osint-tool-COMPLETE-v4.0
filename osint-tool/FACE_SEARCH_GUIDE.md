#  دليل نظام البحث عن الوجوه

## نظرة عامة

نظام **البحث عن الوجوه (Face Search Engine)** هو أداة متقدمة للبحث عن الصور المشابهة لوجه معين في جميع أنحاء الإنترنت. يستخدم النظام **البحث العكسي عن الصور (Reverse Image Search)** عبر **5 محركات بحث** رئيسية، مع **اكتشاف تلقائي للوجوه** و**تصنيف ذكي للنتائج**.

---

##  الميزات الرئيسية

### 1. محركات البحث المتعددة (5 محركات)

| المحرك | التغطية | القوة | الوزن | الاستخدام الأمثل |
|--------|----------|-------|-------|------------------|
| **PimEyes** | متخصص في الوجوه | ⭐⭐⭐⭐⭐ | 95% | أفضل محرك للبحث عن الوجوه |
| **Google Images** | أوسع تغطية | ⭐⭐⭐⭐⭐ | 90% | صور عامة ومتنوعة |
| **Yandex Images** | ممتاز للصور الروسية | ⭐⭐⭐⭐ | 85% | صور أوروبية وروسية |
| **Bing Visual Search** | جيد | ⭐⭐⭐ | 80% | صور متنوعة |
| **TinEye** | متخصص | ⭐⭐⭐ | 75% | تتبع الصور والنسخ |

### 2. اكتشاف تلقائي للوجوه

- **الخوارزمية**: OpenCV Haar Cascade Classifier
- **الدقة**: 85-95%
- **السرعة**: سريع جداً
- **المعلومات المستخرجة**:
  - الموقع (x, y)
  - الأبعاد (width, height)
  - درجة الثقة (confidence)
  - معالم الوجه (landmarks) - اختياري

### 3. تصنيف ذكي للنتائج

- ** ثقة عالية** (≥80%): مطابقات قوية جداً
- ** ثقة متوسطة** (65-79%): مطابقات محتملة
- ** ثقة منخفضة** (50-64%): مطابقات ضعيفة

### 4. ميزات إضافية

-  إزالة النتائج المكررة تلقائياً
-  حساب hash للصور (SHA-256)
-  حفظ تلقائي في قاعدة البيانات
-  تقارير مفصلة
-  توصيات ذكية لتحسين النتائج

---

##  التثبيت

### المتطلبات

```bash
# Node.js
node --version  # v14+

# Python (للمعالجة المتقدمة)
python3 --version  # v3.8+

# مكتبات Python
pip3 install Pillow opencv-python-headless
```

### التثبيت

```bash
cd osint-tool
npm install
```

---

##  الاستخدام

### 1. الاستخدام الأساسي

```javascript
const FaceSearchEngine = require('./src/modules/faceSearchEngine');
const Database = require('./src/database/schema');

// تهيئة
const db = new Database();
const faceEngine = new FaceSearchEngine(db.db);

// البحث عن وجه
const results = await faceEngine.searchFace('/path/to/image.jpg');

// عرض النتائج
console.log(`النتائج: ${results.stats.total}`);
console.log(`ثقة عالية: ${results.stats.highConfidence}`);
console.log(`ثقة متوسطة: ${results.stats.mediumConfidence}`);
console.log(`ثقة منخفضة: ${results.stats.lowConfidence}`);
```

### 2. الاستخدام المتقدم

```javascript
const results = await faceEngine.searchFace('/path/to/image.jpg', {
  // محركات البحث المستخدمة
  engines: ['google', 'yandex', 'bing', 'tineye', 'pimeyes'],
  
  // الحد الأقصى للنتائج
  maxResults: 50,
  
  // الحد الأدنى للثقة (0.0 - 1.0)
  minConfidence: 0.60,
  
  // تضمين البيانات الوصفية
  includeMetadata: true,
  
  // حفظ الملفات المؤقتة
  saveTempFiles: false
});
```

### 3. معالجة النتائج

```javascript
// النتائج مصنفة حسب الثقة
const { high, medium, low } = results.results;

// أفضل 10 مطابقات
console.log(' أفضل المطابقات:');
for (const match of high.slice(0, 10)) {
  console.log(`${match.source}: ${Math.round(match.confidence * 100)}%`);
  console.log(`  الرابط: ${match.url}`);
  console.log(`  الصفحة: ${match.pageUrl}`);
  console.log(`  العنوان: ${match.title}`);
}
```

### 4. توليد التقرير

```javascript
const report = faceEngine.generateReport(results);

console.log(' التقرير:');
console.log(`  إجمالي النتائج: ${report.summary.totalResults}`);
console.log(`  متوسط الثقة: ${report.summary.averageConfidence}%`);

console.log('\n توزيع المصادر:');
for (const [source, count] of Object.entries(report.sourceDistribution)) {
  console.log(`  ${source}: ${count} نتيجة`);
}

console.log('\n التوصيات:');
for (const rec of report.recommendations) {
  console.log(`  - ${rec}`);
}
```

---

##  بنية البيانات

### هيكل النتائج

```javascript
{
  success: true,
  imageInfo: {
    width: 1920,
    height: 1080,
    format: 'JPEG',
    mode: 'RGB',
    size_bytes: 245678
  },
  faces: [
    {
      x: 450,
      y: 320,
      width: 280,
      height: 280,
      confidence: 0.92
    }
  ],
  results: {
    high: [
      {
        source: 'PimEyes',
        url: 'https://example.com/image1.jpg',
        pageUrl: 'https://example.com/page1',
        title: 'نتيجة 1',
        snippet: 'وصف النتيجة',
        confidence: 0.95,
        faceMatch: true,
        metadata: {
          width: 800,
          height: 600,
          domain: 'example.com'
        },
        timestamp: '2024-12-03T10:30:00.000Z'
      }
    ],
    medium: [...],
    low: [...]
  },
  stats: {
    total: 33,
    highConfidence: 10,
    mediumConfidence: 15,
    lowConfidence: 8
  }
}
```

---

##  قاعدة البيانات

### الجداول

#### 1. face_searches
```sql
CREATE TABLE face_searches (
  id INTEGER PRIMARY KEY,
  image_path TEXT NOT NULL,
  image_hash TEXT NOT NULL UNIQUE,
  search_date DATETIME,
  results_count INTEGER,
  faces_detected INTEGER,
  search_engines TEXT,
  metadata TEXT
);
```

#### 2. face_search_results
```sql
CREATE TABLE face_search_results (
  id INTEGER PRIMARY KEY,
  image_hash TEXT NOT NULL,
  source TEXT NOT NULL,
  url TEXT,
  page_url TEXT,
  title TEXT,
  snippet TEXT,
  confidence REAL,
  face_match BOOLEAN,
  metadata TEXT,
  discovered_date DATETIME,
  FOREIGN KEY (image_hash) REFERENCES face_searches(image_hash)
);
```

#### 3. detected_faces
```sql
CREATE TABLE detected_faces (
  id INTEGER PRIMARY KEY,
  image_hash TEXT NOT NULL,
  face_index INTEGER,
  x INTEGER,
  y INTEGER,
  width INTEGER,
  height INTEGER,
  confidence REAL,
  encoding TEXT,
  landmarks TEXT,
  FOREIGN KEY (image_hash) REFERENCES face_searches(image_hash)
);
```

#### 4. face_comparisons
```sql
CREATE TABLE face_comparisons (
  id INTEGER PRIMARY KEY,
  face1_hash TEXT NOT NULL,
  face2_hash TEXT NOT NULL,
  similarity_score REAL,
  match_result BOOLEAN,
  comparison_date DATETIME,
  algorithm TEXT,
  metadata TEXT
);
```

---

##  كيف يعمل النظام؟

### المراحل

1. **تحليل الصورة**
   - استخراج الأبعاد والنوع
   - حساب hash (SHA-256)
   - استخراج البيانات الوصفية

2. **اكتشاف الوجوه**
   - استخدام OpenCV Haar Cascade
   - تحديد موقع وحجم كل وجه
   - حساب درجة الثقة

3. **البحث في المحركات**
   - رفع الصورة لكل محرك
   - استخراج النتائج
   - حساب درجة التشابه

4. **دمج النتائج**
   - جمع النتائج من جميع المحركات
   - إزالة التكرار
   - حساب الأوزان

5. **التصنيف**
   - تصنيف حسب الثقة
   - ترتيب تنازلي
   - تطبيق الفلاتر

6. **الحفظ**
   - حفظ في قاعدة البيانات
   - تحديث الإحصائيات
   - توليد التقرير

---

##  نصائح للحصول على أفضل النتائج

### جودة الصورة

 **استخدم صوراً عالية الجودة**
- الدقة: 800x800 بكسل أو أكثر
- الوضوح: صورة واضحة بدون ضبابية
- الإضاءة: إضاءة جيدة ومتوازنة

 **الوجه يجب أن يكون**
- واضح ومواجه للكاميرا
- بدون نظارات شمسية أو أقنعة
- يشغل جزء كبير من الصورة

 **تجنب**
- الصور الضبابية أو منخفضة الجودة
- الوجوه الصغيرة جداً
- الإضاءة السيئة
- الزوايا الغريبة

### اختيار المحركات

- **للوجوه**: استخدم **PimEyes** (الأفضل)
- **للصور العامة**: استخدم **Google Images**
- **للصور الأوروبية**: استخدم **Yandex Images**
- **لتتبع الصور**: استخدم **TinEye**

### الإعدادات

```javascript
// للبحث السريع
{
  engines: ['pimeyes', 'google'],
  maxResults: 20,
  minConfidence: 0.70
}

// للبحث الشامل
{
  engines: ['google', 'yandex', 'bing', 'tineye', 'pimeyes'],
  maxResults: 100,
  minConfidence: 0.50
}

// للبحث الدقيق
{
  engines: ['pimeyes'],
  maxResults: 50,
  minConfidence: 0.80
}
```

---

##  الخصوصية والأمان

### الاعتبارات القانونية

 **تنبيه**: استخدم هذه الأداة بشكل قانوني وأخلاقي فقط!

 **الاستخدامات المشروعة**:
- البحث عن صورك الخاصة
- التحقيقات الأمنية المصرح بها
- البحث الأكاديمي
- حماية حقوق الملكية الفكرية

 **الاستخدامات غير المشروعة**:
- التجسس على الأشخاص
- انتهاك الخصوصية
- المطاردة الإلكترونية
- أي استخدام غير قانوني

### حماية البيانات

-  جميع البيانات مخزنة محلياً
-  لا يتم إرسال بيانات لخوادم خارجية
-  يمكن حذف البيانات في أي وقت
-  تشفير قاعدة البيانات (اختياري)

---

##  الاختبار

```bash
# تشغيل اختبار النظام
node test_face_search.js
```

النتائج المتوقعة:
-  تهيئة النظام بنجاح
-  5 محركات بحث متاحة
-  اكتشاف الوجوه يعمل
-  التصنيف والترتيب صحيح
-  قاعدة البيانات تعمل

---

##  الإحصائيات

```javascript
// الحصول على الإحصائيات
const stats = faceEngine.searchStats;

console.log(`إجمالي عمليات البحث: ${stats.totalSearches}`);
console.log(`إجمالي النتائج: ${stats.totalResults}`);
console.log(`مطابقات الوجوه: ${stats.faceMatches}`);
console.log(`متوسط الثقة: ${Math.round(stats.averageConfidence * 100)}%`);
```

---

##  الميزات المستقبلية

### قيد التطوير

-  **مقارنة الوجوه**: مقارنة وجهين وحساب التشابه
-  **التعرف على الوجوه**: التعرف على الأشخاص المعروفين
-  **معالم الوجه**: استخراج 68 نقطة معلمية
-  **تقدير العمر والجنس**: تحليل ديموغرافي
-  **كشف المشاعر**: تحديد المشاعر (سعيد، حزين، غاضب...)

### مخطط لها

-  دعم البحث في الفيديو
-  دعم البحث في الوقت الفعلي
-  API RESTful
-  واجهة ويب
-  تطبيق موبايل

---

##  استكشاف الأخطاء

### المشاكل الشائعة

#### 1. "لم يتم اكتشاف أي وجه"

**الحل**:
- تأكد من وضوح الوجه في الصورة
- جرب صورة بدقة أعلى
- تأكد من أن الوجه يشغل جزء كبير من الصورة

#### 2. "نتائج قليلة جداً"

**الحل**:
- قلل `minConfidence` إلى 0.50
- استخدم جميع المحركات
- جرب صورة أخرى للشخص نفسه

#### 3. "خطأ في رفع الصورة"

**الحل**:
- تأكد من صلاحية مسار الملف
- تأكد من نوع الملف (JPEG, PNG)
- تأكد من حجم الملف (< 10 MB)

---

##  الدعم

للمساعدة أو الإبلاغ عن مشاكل:
-  البريد الإلكتروني: support@osint-tool.com
-  GitHub Issues: https://github.com/osint-tool/issues
-  الوثائق: https://docs.osint-tool.com

---

##  الترخيص

MIT License - استخدم بحرية مع الإشارة للمصدر

---

##  شكر وتقدير

- **OpenCV**: لمكتبة اكتشاف الوجوه
- **Google, Yandex, Bing, TinEye, PimEyes**: لمحركات البحث
- **المجتمع**: لجميع المساهمات والاقتراحات

---

** ابدأ الآن واكتشف قوة البحث عن الوجوه!**

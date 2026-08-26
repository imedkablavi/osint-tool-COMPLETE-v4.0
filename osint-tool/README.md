#  OSINT Tool - أداة استخبارات المصادر المفتوحة

## نظرة عامة

أداة OSINT Tool هي تطبيق سطح مكتب مفتوح المصدر مبني باستخدام Electron لجمع وتحليل المعلومات من المصادر العامة (Open Source Intelligence). تهدف الأداة إلى تمكين المحققين والباحثين الأمنيين من جمع معلومات شاملة عن الأفراد من مصادر متعددة وتحليلها بطريقة منظمة وفعالة.

## المميزات الرئيسية

### 1. جمع البيانات التلقائي
- **البحث عن الحسابات الاجتماعية**: فحص 15+ منصة اجتماعية (GitHub, Twitter, Instagram, Facebook, LinkedIn, Reddit, YouTube, TikTok, وغيرها)
- **فحص التسريبات الأمنية**: التحقق من وجود البريد الإلكتروني في قواعد بيانات التسريبات المعروفة
- **تحليل النطاقات**: استعلامات WHOIS للنطاقات المرتبطة بالهدف

### 2. التحليل الذكي
- **خوارزمية ربط البيانات**: حساب نسبة التشابه بين الحسابات المختلفة باستخدام عوامل متعددة
- **تقييم الثقة**: حساب مستوى الثقة لكل معلومة ولكل علاقة
- **اكتشاف الأنماط**: تحليل الأنماط الزمنية والسلوكية

### 3. عرض مرئي تفاعلي
- **شبكة العلاقات**: رسم بياني تفاعلي يوضح العلاقات بين مختلف البيانات
- **تقارير شاملة**: عرض منظم للنتائج مع إحصائيات وملخصات
- **واجهة سهلة الاستخدام**: تصميم عصري وسهل التنقل

### 4. قابلية التوسع
- **بنية وحدية**: سهولة إضافة وحدات جمع بيانات جديدة
- **قاعدة بيانات محلية**: تخزين جميع البيانات محلياً باستخدام SQLite
- **سجلات مفصلة**: تتبع كامل لعملية البحث والتحليل

## البنية التقنية

### التقنيات المستخدمة
- **Electron**: إطار عمل لبناء تطبيقات سطح المكتب
- **Node.js**: بيئة تشغيل JavaScript
- **SQLite**: قاعدة بيانات محلية خفيفة
- **Axios**: مكتبة لإجراء طلبات HTTP
- **Cheerio**: مكتبة لتحليل HTML

### هيكل المشروع

```
osint-tool/
├── src/
│   ├── main/
│   │   └── main.js              # العملية الرئيسية لـ Electron
│   ├── renderer/
│   │   ├── index.html           # واجهة المستخدم
│   │   ├── styles.css           # التنسيقات
│   │   └── renderer.js          # منطق الواجهة
│   ├── modules/
│   │   ├── baseCollector.js     # الفئة الأساسية لوحدات الجمع
│   │   ├── socialMediaCollector.js  # وحدة الحسابات الاجتماعية
│   │   ├── breachCollector.js   # وحدة التسريبات
│   │   └── whoisCollector.js    # وحدة النطاقات
│   ├── database/
│   │   └── schema.js            # مخطط قاعدة البيانات
│   └── utils/
│       └── correlationEngine.js # محرك التحليل والربط
├── data/                        # مجلد قاعدة البيانات
├── assets/                      # الأصول (أيقونات، صور)
├── package.json
└── README.md
```

## التثبيت والتشغيل

### المتطلبات
- Node.js (الإصدار 14 أو أحدث)
- npm أو yarn

### خطوات التثبيت

1. **استنساخ المشروع**
```bash
git clone <repository-url>
cd osint-tool
```

2. **تثبيت المكتبات**
```bash
npm install
```

3. **تشغيل التطبيق**
```bash
npm start
```

4. **تشغيل في وضع التطوير** (مع أدوات المطور)
```bash
npm run dev
```

## الاستخدام

### بدء تحقيق جديد

1. افتح التطبيق
2. انقر على "بحث جديد" من القائمة الجانبية
3. أدخل المعلومات الأساسية:
   - الاسم الكامل (اختياري)
   - البريد الإلكتروني (مطلوب)
   - اسم المستخدم (مطلوب)
4. انقر على "بدء التحقيق"
5. انتظر حتى تكتمل عملية البحث

### عرض النتائج

بعد انتهاء التحقيق، ستظهر النتائج في تبويبات متعددة:

- **نظرة عامة**: ملخص شامل للنتائج
- **الحسابات الاجتماعية**: قائمة بجميع الحسابات المكتشفة
- **التسريبات**: التسريبات الأمنية التي تحتوي على بيانات الهدف
- **النطاقات**: معلومات WHOIS للنطاقات المرتبطة
- **شبكة العلاقات**: رسم بياني تفاعلي للعلاقات
- **السجلات**: سجل مفصل لعملية البحث

### الإعدادات

يمكنك تخصيص الإعدادات من قسم "الإعدادات":
- إضافة مفاتيح API (مثل HaveIBeenPwned)
- تفعيل/تعطيل استخدام Proxy
- تفعيل التسجيل المفصل

## التطوير والمساهمة

### إضافة وحدة جمع بيانات جديدة

1. أنشئ ملف جديد في `src/modules/`
2. قم بتوريث الفئة من `BaseCollector`
3. نفذ دالة `collect()`

مثال:

```javascript
const BaseCollector = require('./baseCollector');

class CustomCollector extends BaseCollector {
  constructor(db) {
    super('CustomCollector', db);
  }

  async collect(personId, searchData) {
    await this.log(personId, 'INFO', 'بدء الجمع المخصص');
    
    // منطق الجمع هنا
    
    return results;
  }
}

module.exports = CustomCollector;
```

4. أضف الوحدة في `src/main/main.js`:

```javascript
const CustomCollector = require('../modules/customCollector');
// ...
collectors.custom = new CustomCollector(db);
```

### تحسين خوارزمية التحليل

يمكنك تحسين خوارزمية الربط في `src/utils/correlationEngine.js`:
- إضافة عوامل تشابه جديدة
- تحسين حساب الأوزان
- إضافة تحليلات إحصائية

## الخصائص المستقبلية (Roadmap)

### المرحلة الثانية
- [ ] تكامل فعلي مع HaveIBeenPwned API
- [ ] استخدام أدوات OSINT خارجية (Sherlock, Maigret)
- [ ] تحليل الصور باستخدام EXIF
- [ ] البحث العكسي عن الصور
- [ ] تحليل أسلوب الكتابة (Stylometry)

### المرحلة الثالثة
- [ ] رسم بياني تفاعلي متقدم (D3.js, vis.js)
- [ ] المحور المرئي للصور والفيديوهات
- [ ] تصدير التقارير (PDF, HTML, JSON)
- [ ] البحث في المنتديات و Pastebin
- [ ] تحليل DNS متقدم

### المرحلة الرابعة
- [ ] استخدام التعلم الآلي للتصنيف
- [ ] دعم Selenium للمواقع الديناميكية
- [ ] تكامل مع Tor للخصوصية
- [ ] واجهة سطر أوامر (CLI)
- [ ] دعم البحث المتوازي

## الاعتبارات القانونية والأخلاقية

 **تحذير مهم**: هذه الأداة مخصصة للأغراض التعليمية والبحثية والتحقيقات المشروعة فقط.

### الاستخدام المشروع
- اختبارات الأمن السيبراني المصرح بها
- التحقيقات القانونية
- البحث الأكاديمي
- حماية الخصوصية الشخصية

### الاستخدام غير المشروع
- التجسس على الأفراد دون إذن
- التحرش أو المطاردة
- سرقة الهوية
- أي نشاط يخالف القوانين المحلية

**المطورون غير مسؤولين عن أي استخدام غير قانوني أو غير أخلاقي للأداة.**

## الترخيص

هذا المشروع مرخص تحت رخصة MIT - انظر ملف [LICENSE](LICENSE) للتفاصيل.

```
MIT License

Copyright (c) 2024 OSINT Tool

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## المساهمون

نرحب بالمساهمات من المجتمع! يمكنك المساهمة عبر:
- الإبلاغ عن الأخطاء (Issues)
- اقتراح ميزات جديدة
- تحسين الكود
- تحسين الوثائق
- إضافة وحدات جديدة

## الدعم

للحصول على الدعم أو الإبلاغ عن مشاكل:
- افتح Issue على GitHub
- راجع الوثائق
- تواصل مع المجتمع

## الشكر والتقدير

هذا المشروع مستوحى من أدوات OSINT المعروفة مثل:
- SpiderFoot
- Sherlock
- Maigret
- theHarvester
- Maltego

شكراً لجميع المطورين والباحثين في مجتمع OSINT على مساهماتهم القيمة.

---

**ملاحظة**: هذا المشروع في مرحلة MVP (Minimum Viable Product) ويتم تطويره بشكل مستمر.

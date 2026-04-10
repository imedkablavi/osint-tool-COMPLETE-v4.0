# دليل المساهمة في OSINT Tool

شكراً لاهتمامك بالمساهمة في مشروع OSINT Tool! نرحب بجميع أنواع المساهمات من المجتمع.

## كيفية المساهمة

### 1. الإبلاغ عن الأخطاء (Bug Reports)

إذا وجدت خطأ في التطبيق:
- تأكد من أن الخطأ لم يتم الإبلاغ عنه مسبقاً
- افتح Issue جديد مع وصف واضح للمشكلة
- أضف خطوات إعادة إنتاج الخطأ
- أرفق لقطات شاشة إن أمكن
- اذكر نظام التشغيل والنسخة المستخدمة

### 2. اقتراح ميزات جديدة

لاقتراح ميزة جديدة:
- افتح Issue مع عنوان واضح
- اشرح الميزة المقترحة بالتفصيل
- وضح حالات الاستخدام
- اقترح طريقة التنفيذ إن أمكن

### 3. المساهمة بالكود

#### الخطوات الأساسية

1. **Fork المشروع**
```bash
# انقر على زر Fork في GitHub
```

2. **استنساخ المشروع**
```bash
git clone https://github.com/YOUR_USERNAME/osint-tool.git
cd osint-tool
```

3. **إنشاء فرع جديد**
```bash
git checkout -b feature/your-feature-name
# أو
git checkout -b fix/bug-description
```

4. **تثبيت المكتبات**
```bash
npm install
```

5. **إجراء التغييرات**
- اكتب كود نظيف ومفهوم
- اتبع معايير الكود الموجودة
- أضف تعليقات توضيحية عند الحاجة

6. **اختبار التغييرات**
```bash
npm start
# أو
node test.js
```

7. **Commit التغييرات**
```bash
git add .
git commit -m "وصف واضح للتغييرات"
```

8. **Push إلى GitHub**
```bash
git push origin feature/your-feature-name
```

9. **فتح Pull Request**
- افتح PR من فرعك إلى الفرع الرئيسي
- اكتب وصفاً واضحاً للتغييرات
- اربط Issue ذات الصلة إن وجدت

## معايير الكود

### JavaScript

```javascript
// استخدم const/let بدلاً من var
const myVariable = 'value';
let counter = 0;

// استخدم أسماء واضحة ومعبرة
function calculateSimilarityScore(account1, account2) {
  // ...
}

// أضف تعليقات للأجزاء المعقدة
// حساب نسبة التشابه باستخدام Levenshtein distance
const distance = levenshteinDistance(str1, str2);

// استخدم async/await للعمليات غير المتزامنة
async function fetchData() {
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error('Error:', error);
  }
}
```

### CSS

```css
/* استخدم أسماء فئات واضحة */
.investigation-card {
  /* ... */
}

/* استخدم متغيرات CSS */
:root {
  --primary-color: #2563eb;
}

/* نظم الكود بشكل منطقي */
/* Layout */
.container { }

/* Components */
.card { }

/* Utilities */
.hidden { }
```

## إضافة وحدة جمع بيانات جديدة

### البنية الأساسية

```javascript
const BaseCollector = require('./baseCollector');

class YourCollector extends BaseCollector {
  constructor(db) {
    super('YourCollector', db);
    // تهيئة إضافية
  }

  async collect(personId, searchData) {
    await this.log(personId, 'INFO', 'بدء الجمع');
    
    const results = [];
    
    try {
      // منطق جمع البيانات
      
      await this.log(personId, 'SUCCESS', 'تم الانتهاء');
    } catch (error) {
      await this.log(personId, 'ERROR', error.message);
    }
    
    return results;
  }
}

module.exports = YourCollector;
```

### التكامل مع النظام

1. أضف الوحدة في `src/main/main.js`:
```javascript
const YourCollector = require('../modules/yourCollector');
// ...
collectors.your = new YourCollector(db);
```

2. استدعِ الوحدة في عملية البحث:
```javascript
results.yourData = await collectors.your.collect(personId, searchData);
```

3. أضف عرض للنتائج في الواجهة

## إضافة جدول جديد في قاعدة البيانات

في `src/database/schema.js`:

```javascript
this.db.exec(`
  CREATE TABLE IF NOT EXISTS your_table (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id INTEGER,
    field1 TEXT,
    field2 INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (person_id) REFERENCES persons(id)
  )
`);
```

أضف دوال للتعامل مع الجدول:

```javascript
addYourData(personId, data) {
  const stmt = this.db.prepare(`
    INSERT INTO your_table (person_id, field1, field2)
    VALUES (?, ?, ?)
  `);
  return stmt.run(personId, data.field1, data.field2);
}

getYourData(personId) {
  const stmt = this.db.prepare('SELECT * FROM your_table WHERE person_id = ?');
  return stmt.all(personId);
}
```

## تحسين محرك التحليل

في `src/utils/correlationEngine.js`:

### إضافة عامل تشابه جديد

```javascript
calculateSimilarity(account1, account2) {
  const factors = {};
  let totalWeight = 0;

  // عامل جديد
  if (account1.yourField && account2.yourField) {
    const match = this.compareYourField(account1.yourField, account2.yourField);
    factors.yourField = match * 20; // الوزن
    totalWeight += 20;
  }

  // ... باقي العوامل
}

compareYourField(field1, field2) {
  // منطق المقارنة
  return similarity; // قيمة بين 0 و 1
}
```

## الاختبار

### اختبار يدوي

```bash
npm start
```

### اختبار المكونات

```bash
node test.js
```

### اختبار وحدة محددة

```javascript
// test-your-module.js
const YourCollector = require('./src/modules/yourCollector');
const DatabaseManager = require('./src/database/schema');

async function test() {
  const db = new DatabaseManager();
  const collector = new YourCollector(db);
  
  const results = await collector.collect(1, {
    email: 'test@example.com',
    username: 'testuser'
  });
  
  console.log('Results:', results);
  db.close();
}

test();
```

## التوثيق

عند إضافة ميزة جديدة:
- حدّث README.md
- أضف تعليقات في الكود
- اكتب أمثلة للاستخدام
- حدّث CHANGELOG.md

## الالتزام بالمعايير الأخلاقية

جميع المساهمات يجب أن:
- تحترم الخصوصية
- تلتزم بالقوانين
- لا تشجع على الاستخدام غير الأخلاقي
- تتضمن تحذيرات مناسبة

## أسئلة شائعة

### كيف أختبر التطبيق؟
```bash
npm start
```

### كيف أضيف مكتبة جديدة؟
```bash
npm install package-name --save
```

### كيف أصلح خطأ في قاعدة البيانات؟
احذف مجلد `data/` وأعد تشغيل التطبيق

### كيف أتواصل مع المطورين؟
افتح Issue على GitHub أو Discussion

## الترخيص

بمساهمتك في هذا المشروع، فإنك توافق على أن تكون مساهمتك مرخصة تحت رخصة MIT.

## شكراً!

شكراً لمساهمتك في جعل OSINT Tool أفضل! 🎉

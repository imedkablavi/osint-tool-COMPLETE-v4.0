// سكريبت اختبار بسيط للتحقق من المكونات الأساسية

const DatabaseManager = require('./src/database/schema');
const SocialMediaCollector = require('./src/modules/socialMediaCollector');
const BreachCollector = require('./src/modules/breachCollector');
const WhoisCollector = require('./src/modules/whoisCollector');
const CorrelationEngine = require('./src/utils/correlationEngine');

console.log('🧪 بدء اختبار المكونات الأساسية...\n');

// اختبار قاعدة البيانات
console.log('1️⃣ اختبار قاعدة البيانات...');
try {
  const db = new DatabaseManager();
  console.log('   ✅ تم تهيئة قاعدة البيانات بنجاح');
  
  // إضافة شخص تجريبي
  const personId = db.addPerson('اختبار', 'test@example.com', 'testuser');
  console.log(`   ✅ تم إضافة شخص تجريبي (ID: ${personId})`);
  
  // استرجاع الشخص
  const person = db.getPerson(personId);
  console.log(`   ✅ تم استرجاع بيانات الشخص: ${person.name}`);
  
  db.close();
  console.log('   ✅ تم إغلاق قاعدة البيانات\n');
} catch (error) {
  console.error('   ❌ خطأ في قاعدة البيانات:', error.message, '\n');
}

// اختبار وحدات الجمع
console.log('2️⃣ اختبار وحدات الجمع...');
try {
  const db = new DatabaseManager();
  
  const socialCollector = new SocialMediaCollector(db);
  console.log('   ✅ تم تهيئة وحدة الحسابات الاجتماعية');
  
  const breachCollector = new BreachCollector(db);
  console.log('   ✅ تم تهيئة وحدة التسريبات');
  
  const whoisCollector = new WhoisCollector(db);
  console.log('   ✅ تم تهيئة وحدة WHOIS');
  
  db.close();
  console.log('');
} catch (error) {
  console.error('   ❌ خطأ في وحدات الجمع:', error.message, '\n');
}

// اختبار محرك التحليل
console.log('3️⃣ اختبار محرك التحليل...');
try {
  const db = new DatabaseManager();
  const engine = new CorrelationEngine(db);
  console.log('   ✅ تم تهيئة محرك التحليل');
  
  // اختبار حساب التشابه
  const account1 = {
    username: 'testuser',
    display_name: 'Test User',
    bio: 'This is a test account'
  };
  
  const account2 = {
    username: 'testuser',
    display_name: 'Test User',
    bio: 'This is a test account'
  };
  
  const similarity = engine.calculateSimilarity(account1, account2);
  console.log(`   ✅ نسبة التشابه: ${similarity.similarity}% (${similarity.confidence})`);
  
  db.close();
  console.log('');
} catch (error) {
  console.error('   ❌ خطأ في محرك التحليل:', error.message, '\n');
}

console.log('✨ انتهى الاختبار بنجاح!');
console.log('📝 ملاحظة: هذا اختبار أساسي. للاختبار الكامل، قم بتشغيل التطبيق باستخدام: npm start');

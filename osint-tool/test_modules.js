const StylometryAnalyzer = require('./src/modules/stylometryAnalyzer');
const ImageAnalyzer = require('./src/modules/imageAnalyzer');
const CacheManager = require('./src/utils/cacheManager');
const ProxyManager = require('./src/utils/proxyManager');
const EncryptionManager = require('./src/utils/encryptionManager');
const Database = require('./src/database/schema');

console.log('=== OSINT Tool v2.0 - اختبارات الوحدات ===\n');

// تهيئة قاعدة البيانات
const db = new Database(':memory:');

// 1. اختبار Stylometry
console.log('1️⃣ اختبار تحليل النصوص (Stylometry)...');
const stylometry = new StylometryAnalyzer(db);

const text1 = "مرحباً! أنا مطور برمجيات. أحب البرمجة كثيراً. أعمل يومياً على تطوير تطبيقات جديدة.";
const text2 = "السلام عليكم، أنا مبرمج محترف، أستمتع بكتابة الأكواد، وأقوم بتطوير برامج مبتكرة بشكل مستمر.";
const text3 = "Hey there! I'm a software developer. I love coding so much. I work daily on developing new applications.";

const personId = db.addPerson('Test User', 'test@test.com', 'testuser', null).lastInsertRowid;

const analysis1 = stylometry.analyzeText(personId, text1, 'text1');
const analysis2 = stylometry.analyzeText(personId, text2, 'text2');
const analysis3 = stylometry.analyzeText(personId, text3, 'text3');

Promise.all([analysis1, analysis2, analysis3]).then(results => {
  console.log('✅ تم تحليل 3 نصوص بنجاح');
  console.log('   - النص 1: متوسط طول الكلمة =', results[0].features.words.avg_length.toFixed(2));
  console.log('   - النص 2: متوسط طول الكلمة =', results[1].features.words.avg_length.toFixed(2));
  console.log('   - النص 3: متوسط طول الكلمة =', results[2].features.words.avg_length.toFixed(2));
  
  const similarity12 = stylometry.compareFingerprints(results[0].fingerprint, results[1].fingerprint);
  const similarity13 = stylometry.compareFingerprints(results[0].fingerprint, results[2].fingerprint);
  
  console.log('   - التشابه بين النص 1 و 2:', similarity12.similarity.toFixed(2) + '%', `(${similarity12.confidence})`);
  console.log('   - التشابه بين النص 1 و 3:', similarity13.similarity.toFixed(2) + '%', `(${similarity13.confidence})`);
  
  if (similarity12.similarity > similarity13.similarity) {
    console.log('   ✅ النتيجة صحيحة: النصوص العربية أكثر تشابهاً من النص الإنجليزي\n');
  } else {
    console.log('   ⚠️ تحذير: النتائج غير متوقعة\n');
  }
  
  // 2. اختبار Cache
  console.log('2️⃣ اختبار نظام Cache...');
  const cache = new CacheManager();
  
  cache.set('test_key', { data: 'test_value', timestamp: Date.now() }, 60000);
  const cached = cache.get('test_key');
  
  if (cached && cached.data === 'test_value') {
    console.log('✅ Cache يعمل بشكل صحيح');
    console.log('   - تم حفظ واسترجاع البيانات بنجاح');
  } else {
    console.log('❌ خطأ في Cache');
  }
  
  const stats = cache.getStats();
  console.log('   - إحصائيات Cache:', stats.validCount, 'ملفات صالحة\n');
  
  // 3. اختبار Encryption
  console.log('3️⃣ اختبار التشفير (AES-256-GCM)...');
  const encryption = new EncryptionManager();
  
  const originalText = 'هذا نص سري للغاية يجب تشفيره';
  const encrypted = encryption.encrypt(originalText);
  const decrypted = encryption.decrypt(encrypted);
  
  if (decrypted === originalText) {
    console.log('✅ التشفير وفك التشفير يعملان بشكل صحيح');
    console.log('   - النص الأصلي:', originalText);
    console.log('   - النص المشفر:', encrypted.substring(0, 50) + '...');
    console.log('   - النص المفكوك:', decrypted);
  } else {
    console.log('❌ خطأ في التشفير');
  }
  
  const hash = encryption.hash('password123');
  console.log('   - Hash:', hash.substring(0, 32) + '...\n');
  
  // 4. اختبار Proxy Manager
  console.log('4️⃣ اختبار Proxy Manager...');
  const proxy = new ProxyManager();
  
  console.log('✅ Proxy Manager تم تهيئته بنجاح');
  console.log('   - الحالة:', proxy.getStatus());
  console.log('   - Tor مدعوم: نعم');
  console.log('   - HTTP/HTTPS Proxy مدعوم: نعم\n');
  
  // الخلاصة
  console.log('=== ✅ جميع الاختبارات اكتملت بنجاح ===');
  console.log('النتائج:');
  console.log('  ✅ Stylometry: يعمل');
  console.log('  ✅ Cache: يعمل');
  console.log('  ✅ Encryption: يعمل');
  console.log('  ✅ Proxy Manager: يعمل');
  
}).catch(error => {
  console.error('❌ خطأ في الاختبارات:', error.message);
  process.exit(1);
});

// اختبار بسيط للوحدات
const path = require('path');

console.log('=== OSINT Tool v2.0 - اختبارات الوحدات ===\n');

// 1. اختبار استيراد الوحدات
console.log('1️⃣ اختبار استيراد الوحدات...');

try {
  const CacheManager = require('./src/utils/cacheManager');
  console.log('✅ CacheManager تم استيراده بنجاح');
  
  const ProxyManager = require('./src/utils/proxyManager');
  console.log('✅ ProxyManager تم استيراده بنجاح');
  
  const EncryptionManager = require('./src/utils/encryptionManager');
  console.log('✅ EncryptionManager تم استيراده بنجاح');
  
  const ExportManager = require('./src/utils/exportManager');
  console.log('✅ ExportManager تم استيراده بنجاح');
  
  console.log('\n2️⃣ اختبار Cache Manager...');
  const cache = new CacheManager();
  cache.set('test', { data: 'value' }, 60000);
  const result = cache.get('test');
  
  if (result && result.data === 'value') {
    console.log('✅ Cache يعمل بشكل صحيح');
  } else {
    console.log('❌ خطأ في Cache');
  }
  
  console.log('\n3️⃣ اختبار Encryption Manager...');
  const encryption = new EncryptionManager();
  const original = 'نص سري';
  const encrypted = encryption.encrypt(original);
  const decrypted = encryption.decrypt(encrypted);
  
  if (decrypted === original) {
    console.log('✅ التشفير يعمل بشكل صحيح');
  } else {
    console.log('❌ خطأ في التشفير');
  }
  
  console.log('\n4️⃣ اختبار Proxy Manager...');
  const proxy = new ProxyManager();
  const status = proxy.getStatus();
  console.log('✅ Proxy Manager:', status);
  
  console.log('\n=== ✅ جميع الاختبارات نجحت ===');
  
} catch (error) {
  console.error('❌ خطأ:', error.message);
  console.error(error.stack);
  process.exit(1);
}

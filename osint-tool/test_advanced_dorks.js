/**
 * اختبار نظام Google Dorks المتقدم
 */

const AdvancedGoogleDorksEngine = require('./src/modules/advancedGoogleDorks');
const Database = require('./src/database/schema');

console.log('=== اختبار نظام Google Dorks المتقدم ===\n');

// تهيئة قاعدة البيانات
const db = new Database(':memory:');

// تهيئة المحرك
const dorksEngine = new AdvancedGoogleDorksEngine(db);

// بيانات اختبارية
const testPersonData = {
  fullName: 'John Smith',
  firstName: 'John',
  lastName: 'Smith',
  email: 'john.smith@example.com',
  username: 'johnsmith',
  phone: '+1-555-123-4567',
  location: 'New York',
  occupation: 'Software Engineer'
};

console.log('📋 بيانات الاختبار:');
console.log(JSON.stringify(testPersonData, null, 2));
console.log('\n' + '='.repeat(80) + '\n');

// توليد الاستعلامات
console.log('🔍 توليد الاستعلامات الذكية...\n');

const queries = dorksEngine.generateSmartQueries(testPersonData);

console.log(`✅ تم توليد ${queries.length} استعلام ذكي\n`);

// عرض أول 30 استعلام كأمثلة
console.log('📊 أمثلة على الاستعلامات المولدة:\n');

const categories = {
  'استعلامات أساسية': queries.filter(q => !q.includes('site:') && !q.includes('filetype:')).slice(0, 5),
  'البحث في المنصات الاجتماعية': queries.filter(q => q.includes('site:') && (q.includes('facebook') || q.includes('twitter') || q.includes('instagram'))).slice(0, 5),
  'البحث في منصات مهنية': queries.filter(q => q.includes('site:') && (q.includes('linkedin') || q.includes('github'))).slice(0, 5),
  'البحث عن الوثائق': queries.filter(q => q.includes('filetype:')).slice(0, 5),
  'البحث في مواقع التسريبات': queries.filter(q => q.includes('pastebin') || q.includes('leak') || q.includes('breach')).slice(0, 5),
  'استعلامات مركبة': queries.filter(q => q.includes('AND') || q.includes('OR')).slice(0, 5)
};

for (const [category, categoryQueries] of Object.entries(categories)) {
  if (categoryQueries.length > 0) {
    console.log(`\n📁 ${category}:`);
    console.log('─'.repeat(80));
    categoryQueries.forEach((q, i) => {
      console.log(`  ${i + 1}. ${q}`);
    });
  }
}

console.log('\n' + '='.repeat(80) + '\n');

// تحليل الاستعلامات
console.log('📈 تحليل الاستعلامات:\n');

const analysis = {
  total: queries.length,
  basic: queries.filter(q => !q.includes('site:') && !q.includes('filetype:')).length,
  siteSpecific: queries.filter(q => q.includes('site:')).length,
  fileType: queries.filter(q => q.includes('filetype:')).length,
  advanced: queries.filter(q => q.includes('AND') || q.includes('OR') || q.includes('-')).length,
  social: queries.filter(q => q.includes('facebook') || q.includes('twitter') || q.includes('instagram')).length,
  professional: queries.filter(q => q.includes('linkedin') || q.includes('github')).length,
  leaks: queries.filter(q => q.includes('pastebin') || q.includes('leak')).length
};

console.log('الإحصائيات:');
console.log('─'.repeat(80));
console.log(`  📊 إجمالي الاستعلامات: ${analysis.total}`);
console.log(`  🔍 استعلامات أساسية: ${analysis.basic}`);
console.log(`  🌐 استعلامات موقع محدد (site:): ${analysis.siteSpecific}`);
console.log(`  📄 استعلامات نوع ملف (filetype:): ${analysis.fileType}`);
console.log(`  🔗 استعلامات متقدمة (AND/OR/-): ${analysis.advanced}`);
console.log(`  📱 منصات اجتماعية: ${analysis.social}`);
console.log(`  💼 منصات مهنية: ${analysis.professional}`);
console.log(`  🔓 مواقع تسريبات: ${analysis.leaks}`);

console.log('\n' + '='.repeat(80) + '\n');

// اختبار تنسيق رقم الهاتف
console.log('📞 اختبار تنسيقات رقم الهاتف:\n');

const phoneFormats = dorksEngine.formatPhoneNumber(testPersonData.phone);
console.log('التنسيقات المولدة:');
phoneFormats.forEach((format, i) => {
  console.log(`  ${i + 1}. "${format}"`);
});

console.log('\n' + '='.repeat(80) + '\n');

// اختبار استعلامات البريد الإلكتروني
console.log('📧 استعلامات البريد الإلكتروني المتخصصة:\n');

const emailQueries = dorksEngine.generateEmailQueries(testPersonData.email);
console.log(`تم توليد ${emailQueries.length} استعلام للبريد الإلكتروني\n`);

const emailCategories = {
  'مباشرة': emailQueries.filter(q => !q.includes('site:') && !q.includes('filetype:') && !q.includes('*')).slice(0, 3),
  'مواقع تسريبات': emailQueries.filter(q => q.includes('pastebin') || q.includes('leak')).slice(0, 3),
  'منصات اجتماعية': emailQueries.filter(q => q.includes('site:') && !q.includes('pastebin')).slice(0, 3),
  'وثائق': emailQueries.filter(q => q.includes('filetype:')).slice(0, 3),
  'Wildcard': emailQueries.filter(q => q.includes('*')).slice(0, 3)
};

for (const [category, categoryQueries] of Object.entries(emailCategories)) {
  if (categoryQueries.length > 0) {
    console.log(`${category}:`);
    categoryQueries.forEach((q, i) => {
      console.log(`  ${i + 1}. ${q}`);
    });
    console.log();
  }
}

console.log('='.repeat(80) + '\n');

// اختبار استعلامات اسم المستخدم
console.log('👤 استعلامات اسم المستخدم المتخصصة:\n');

const usernameQueries = dorksEngine.generateUsernameQueries(testPersonData.username);
console.log(`تم توليد ${usernameQueries.length} استعلام لاسم المستخدم\n`);

const usernameCategories = {
  'أساسية': usernameQueries.filter(q => !q.includes('site:')).slice(0, 3),
  'منصات اجتماعية': usernameQueries.filter(q => q.includes('facebook') || q.includes('twitter')).slice(0, 3),
  'منصات كود': usernameQueries.filter(q => q.includes('github') || q.includes('gitlab')).slice(0, 3),
  'منتديات': usernameQueries.filter(q => q.includes('reddit') || q.includes('stackoverflow')).slice(0, 3)
};

for (const [category, categoryQueries] of Object.entries(usernameCategories)) {
  if (categoryQueries.length > 0) {
    console.log(`${category}:`);
    categoryQueries.forEach((q, i) => {
      console.log(`  ${i + 1}. ${q}`);
    });
    console.log();
  }
}

console.log('='.repeat(80) + '\n');

// اختبار الاستعلامات المركبة
console.log('🔗 استعلامات مركبة متقدمة:\n');

const combinedQueries = dorksEngine.generateCombinedQueries(testPersonData);
console.log(`تم توليد ${combinedQueries.length} استعلام مركب\n`);

console.log('أمثلة:');
combinedQueries.slice(0, 10).forEach((q, i) => {
  console.log(`  ${i + 1}. ${q}`);
});

console.log('\n' + '='.repeat(80) + '\n');

// الخلاصة
console.log('✅ اكتمل الاختبار بنجاح!\n');

console.log('📊 الملخص النهائي:');
console.log('─'.repeat(80));
console.log(`  ✅ إجمالي الاستعلامات المولدة: ${queries.length}`);
console.log(`  ✅ تنسيقات رقم الهاتف: ${phoneFormats.length}`);
console.log(`  ✅ استعلامات البريد: ${emailQueries.length}`);
console.log(`  ✅ استعلامات اسم المستخدم: ${usernameQueries.length}`);
console.log(`  ✅ استعلامات مركبة: ${combinedQueries.length}`);
console.log();
console.log('🎯 النظام جاهز للاستخدام الفوري!');
console.log();
console.log('💡 ملاحظة: هذا اختبار لتوليد الاستعلامات فقط.');
console.log('   للبحث الفعلي، استخدم: dorksEngine.search(personId, personData)');
console.log();

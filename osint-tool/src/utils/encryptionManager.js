const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * EncryptionManager - نظام تشفير لحماية البيانات الحساسة
 */
class EncryptionManager {
  constructor(keyPath = null) {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16;  // 128 bits
    this.saltLength = 64;
    this.tagLength = 16;
    
    this.keyPath = keyPath || path.join(__dirname, '../../.encryption-key');
    this.masterKey = null;
    
    // تحميل أو إنشاء المفتاح الرئيسي
    this.loadOrCreateMasterKey();
  }

  /**
   * تحميل أو إنشاء المفتاح الرئيسي
   */
  loadOrCreateMasterKey() {
    try {
      if (fs.existsSync(this.keyPath)) {
        // تحميل المفتاح الموجود
        const keyData = fs.readFileSync(this.keyPath, 'utf8');
        this.masterKey = Buffer.from(keyData, 'hex');
        console.log('✅ تم تحميل مفتاح التشفير');
      } else {
        // إنشاء مفتاح جديد
        this.masterKey = crypto.randomBytes(this.keyLength);
        fs.writeFileSync(this.keyPath, this.masterKey.toString('hex'), 'utf8');
        
        // تعيين أذونات محدودة للملف
        fs.chmodSync(this.keyPath, 0o600);
        
        console.log('✅ تم إنشاء مفتاح تشفير جديد');
      }
    } catch (error) {
      console.error('خطأ في تحميل/إنشاء المفتاح:', error);
      throw error;
    }
  }

  /**
   * تشفير نص
   */
  encrypt(text) {
    try {
      // إنشاء IV عشوائي
      const iv = crypto.randomBytes(this.ivLength);
      
      // إنشاء cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.masterKey, iv);
      
      // تشفير النص
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // الحصول على authentication tag
      const authTag = cipher.getAuthTag();
      
      // دمج IV + authTag + encrypted data
      const result = {
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        encrypted: encrypted
      };
      
      return JSON.stringify(result);
      
    } catch (error) {
      console.error('خطأ في التشفير:', error);
      throw error;
    }
  }

  /**
   * فك تشفير نص
   */
  decrypt(encryptedData) {
    try {
      // تحليل البيانات المشفرة
      const data = JSON.parse(encryptedData);
      
      const iv = Buffer.from(data.iv, 'hex');
      const authTag = Buffer.from(data.authTag, 'hex');
      const encrypted = data.encrypted;
      
      // إنشاء decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.masterKey, iv);
      decipher.setAuthTag(authTag);
      
      // فك التشفير
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
      
    } catch (error) {
      console.error('خطأ في فك التشفير:', error);
      throw error;
    }
  }

  /**
   * تشفير ملف
   */
  encryptFile(inputPath, outputPath) {
    try {
      // قراءة الملف
      const data = fs.readFileSync(inputPath, 'utf8');
      
      // تشفير المحتوى
      const encrypted = this.encrypt(data);
      
      // كتابة الملف المشفر
      fs.writeFileSync(outputPath, encrypted, 'utf8');
      
      console.log(`✅ تم تشفير الملف: ${outputPath}`);
      return true;
      
    } catch (error) {
      console.error('خطأ في تشفير الملف:', error);
      return false;
    }
  }

  /**
   * فك تشفير ملف
   */
  decryptFile(inputPath, outputPath) {
    try {
      // قراءة الملف المشفر
      const encryptedData = fs.readFileSync(inputPath, 'utf8');
      
      // فك التشفير
      const decrypted = this.decrypt(encryptedData);
      
      // كتابة الملف المفكوك
      fs.writeFileSync(outputPath, decrypted, 'utf8');
      
      console.log(`✅ تم فك تشفير الملف: ${outputPath}`);
      return true;
      
    } catch (error) {
      console.error('خطأ في فك تشفير الملف:', error);
      return false;
    }
  }

  /**
   * إنشاء hash آمن
   */
  hash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * إنشاء hash مع salt
   */
  hashWithSalt(data, salt = null) {
    if (!salt) {
      salt = crypto.randomBytes(this.saltLength).toString('hex');
    }
    
    const hash = crypto.pbkdf2Sync(data, salt, 100000, 64, 'sha512').toString('hex');
    
    return {
      hash: hash,
      salt: salt
    };
  }

  /**
   * التحقق من hash
   */
  verifyHash(data, hash, salt) {
    const newHash = crypto.pbkdf2Sync(data, salt, 100000, 64, 'sha512').toString('hex');
    return newHash === hash;
  }

  /**
   * إنشاء مفتاح عشوائي
   */
  generateRandomKey(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * تشفير كلمة مرور
   */
  encryptPassword(password) {
    return this.hashWithSalt(password);
  }

  /**
   * التحقق من كلمة مرور
   */
  verifyPassword(password, hash, salt) {
    return this.verifyHash(password, hash, salt);
  }

  /**
   * تشفير قاعدة البيانات (SQLite)
   */
  encryptDatabase(dbPath) {
    try {
      // قراءة ملف قاعدة البيانات
      const dbData = fs.readFileSync(dbPath);
      
      // تشفير البيانات
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, this.masterKey, iv);
      
      let encrypted = cipher.update(dbData);
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      
      const authTag = cipher.getAuthTag();
      
      // حفظ البيانات المشفرة
      const encryptedPath = `${dbPath}.encrypted`;
      const header = Buffer.concat([
        iv,
        authTag,
        encrypted
      ]);
      
      fs.writeFileSync(encryptedPath, header);
      
      console.log(`✅ تم تشفير قاعدة البيانات: ${encryptedPath}`);
      return encryptedPath;
      
    } catch (error) {
      console.error('خطأ في تشفير قاعدة البيانات:', error);
      return null;
    }
  }

  /**
   * فك تشفير قاعدة البيانات
   */
  decryptDatabase(encryptedPath, outputPath) {
    try {
      // قراءة الملف المشفر
      const encryptedData = fs.readFileSync(encryptedPath);
      
      // استخراج المكونات
      const iv = encryptedData.slice(0, this.ivLength);
      const authTag = encryptedData.slice(this.ivLength, this.ivLength + this.tagLength);
      const encrypted = encryptedData.slice(this.ivLength + this.tagLength);
      
      // فك التشفير
      const decipher = crypto.createDecipheriv(this.algorithm, this.masterKey, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      // حفظ قاعدة البيانات المفكوكة
      fs.writeFileSync(outputPath, decrypted);
      
      console.log(`✅ تم فك تشفير قاعدة البيانات: ${outputPath}`);
      return true;
      
    } catch (error) {
      console.error('خطأ في فك تشفير قاعدة البيانات:', error);
      return false;
    }
  }

  /**
   * حذف المفتاح الرئيسي (خطير!)
   */
  deleteMasterKey() {
    try {
      if (fs.existsSync(this.keyPath)) {
        fs.unlinkSync(this.keyPath);
        this.masterKey = null;
        console.log('⚠️ تم حذف مفتاح التشفير');
        return true;
      }
      return false;
    } catch (error) {
      console.error('خطأ في حذف المفتاح:', error);
      return false;
    }
  }

  /**
   * تصدير المفتاح (للنسخ الاحتياطي)
   */
  exportKey() {
    if (!this.masterKey) {
      throw new Error('لا يوجد مفتاح محمّل');
    }
    
    return this.masterKey.toString('hex');
  }

  /**
   * استيراد مفتاح
   */
  importKey(keyHex) {
    try {
      this.masterKey = Buffer.from(keyHex, 'hex');
      fs.writeFileSync(this.keyPath, keyHex, 'utf8');
      fs.chmodSync(this.keyPath, 0o600);
      
      console.log('✅ تم استيراد المفتاح بنجاح');
      return true;
    } catch (error) {
      console.error('خطأ في استيراد المفتاح:', error);
      return false;
    }
  }
}

module.exports = EncryptionManager;

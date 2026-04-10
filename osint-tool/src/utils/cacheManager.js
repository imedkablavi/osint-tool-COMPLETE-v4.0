const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * CacheManager - نظام Cache ذكي لحفظ النتائج وتقليل الطلبات
 */
class CacheManager {
  constructor(cacheDir = null) {
    this.cacheDir = cacheDir || path.join(__dirname, '../../cache');
    this.defaultTTL = 24 * 60 * 60 * 1000; // 24 ساعة
    
    // إنشاء مجلد Cache إذا لم يكن موجوداً
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
    
    // تنظيف Cache القديم عند التهيئة
    this.cleanExpiredCache();
  }

  /**
   * إنشاء مفتاح Cache من البيانات
   */
  generateKey(data) {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  /**
   * حفظ بيانات في Cache
   */
  set(key, data, ttl = null) {
    try {
      const cacheKey = this.generateKey(key);
      const cachePath = path.join(this.cacheDir, `${cacheKey}.json`);
      
      const cacheData = {
        key: key,
        data: data,
        timestamp: Date.now(),
        ttl: ttl || this.defaultTTL,
        expiresAt: Date.now() + (ttl || this.defaultTTL)
      };
      
      fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2), 'utf8');
      return true;
      
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * استرجاع بيانات من Cache
   */
  get(key) {
    try {
      const cacheKey = this.generateKey(key);
      const cachePath = path.join(this.cacheDir, `${cacheKey}.json`);
      
      if (!fs.existsSync(cachePath)) {
        return null;
      }
      
      const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      
      // التحقق من انتهاء الصلاحية
      if (Date.now() > cacheData.expiresAt) {
        this.delete(key);
        return null;
      }
      
      return cacheData.data;
      
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * التحقق من وجود بيانات في Cache
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * حذف بيانات من Cache
   */
  delete(key) {
    try {
      const cacheKey = this.generateKey(key);
      const cachePath = path.join(this.cacheDir, `${cacheKey}.json`);
      
      if (fs.existsSync(cachePath)) {
        fs.unlinkSync(cachePath);
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * مسح جميع Cache
   */
  clear() {
    try {
      const files = fs.readdirSync(this.cacheDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          fs.unlinkSync(path.join(this.cacheDir, file));
        }
      }
      
      return true;
      
    } catch (error) {
      console.error('Cache clear error:', error);
      return false;
    }
  }

  /**
   * تنظيف Cache المنتهي الصلاحية
   */
  cleanExpiredCache() {
    try {
      const files = fs.readdirSync(this.cacheDir);
      let cleaned = 0;
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.cacheDir, file);
          
          try {
            const cacheData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            if (Date.now() > cacheData.expiresAt) {
              fs.unlinkSync(filePath);
              cleaned++;
            }
          } catch (error) {
            // ملف تالف، احذفه
            fs.unlinkSync(filePath);
            cleaned++;
          }
        }
      }
      
      console.log(`تم تنظيف ${cleaned} ملف Cache منتهي الصلاحية`);
      return cleaned;
      
    } catch (error) {
      console.error('Cache cleanup error:', error);
      return 0;
    }
  }

  /**
   * الحصول على إحصائيات Cache
   */
  getStats() {
    try {
      const files = fs.readdirSync(this.cacheDir);
      let totalSize = 0;
      let validCount = 0;
      let expiredCount = 0;
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.cacheDir, file);
          const stats = fs.statSync(filePath);
          totalSize += stats.size;
          
          try {
            const cacheData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            if (Date.now() > cacheData.expiresAt) {
              expiredCount++;
            } else {
              validCount++;
            }
          } catch (error) {
            expiredCount++;
          }
        }
      }
      
      return {
        totalFiles: files.length,
        validCount: validCount,
        expiredCount: expiredCount,
        totalSize: totalSize,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2)
      };
      
    } catch (error) {
      console.error('Cache stats error:', error);
      return null;
    }
  }

  /**
   * Cache مع دالة fallback
   */
  async remember(key, callback, ttl = null) {
    // محاولة الحصول من Cache
    const cached = this.get(key);
    
    if (cached !== null) {
      console.log(`Cache hit: ${key}`);
      return cached;
    }
    
    // إذا لم يكن موجوداً، استدعاء الدالة
    console.log(`Cache miss: ${key}`);
    const data = await callback();
    
    // حفظ في Cache
    this.set(key, data, ttl);
    
    return data;
  }
}

module.exports = CacheManager;

const BaseCollector = require('./baseCollector');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * ImageAnalyzer - تحليل الصور واستخراج بيانات EXIF والبحث العكسي
 */
class ImageAnalyzer extends BaseCollector {
  constructor(db) {
    super('ImageAnalyzer', db);
    this.tempDir = path.join(__dirname, '../../temp/images');
    
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * تحليل صورة شامل
   */
  async analyzeImage(personId, imageUrl) {
    await this.log(personId, 'INFO', `بدء تحليل الصورة: ${imageUrl}`);
    
    const results = {
      url: imageUrl,
      exif: null,
      reverseSearch: [],
      metadata: {}
    };

    try {
      // تحميل الصورة
      const imagePath = await this.downloadImage(imageUrl);
      
      // استخراج EXIF
      results.exif = await this.extractEXIF(imagePath);
      
      // البحث العكسي
      results.reverseSearch = await this.reverseImageSearch(imagePath, imageUrl);
      
      // حفظ النتائج
      await this.saveImageAnalysis(personId, results);
      
      // حذف الصورة المؤقتة
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
      
      await this.log(personId, 'SUCCESS', 'تم تحليل الصورة بنجاح');
      
    } catch (error) {
      await this.log(personId, 'ERROR', `خطأ في تحليل الصورة: ${error.message}`);
      console.error('Image analysis error:', error);
    }
    
    return results;
  }

  /**
   * تحميل صورة من URL
   */
  async downloadImage(imageUrl) {
    const fileName = `image_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
    const filePath = path.join(this.tempDir, fileName);
    
    try {
      const response = await axios({
        method: 'get',
        url: imageUrl,
        responseType: 'stream',
        timeout: 30000
      });
      
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);
      
      return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(filePath));
        writer.on('error', reject);
      });
      
    } catch (error) {
      throw new Error(`فشل تحميل الصورة: ${error.message}`);
    }
  }

  /**
   * استخراج بيانات EXIF من الصورة
   */
  async extractEXIF(imagePath) {
    return new Promise((resolve, reject) => {
      // استخدام exiftool (أداة قوية لاستخراج EXIF)
      const command = `python3 -c "
import exifread
import json
import sys

try:
    with open('${imagePath}', 'rb') as f:
        tags = exifread.process_file(f, details=False)
        
    # تحويل البيانات إلى JSON
    exif_data = {}
    for tag, value in tags.items():
        if tag not in ['JPEGThumbnail', 'TIFFThumbnail', 'Filename', 'EXIF MakerNote']:
            try:
                exif_data[tag] = str(value)
            except:
                pass
    
    print(json.dumps(exif_data, ensure_ascii=False))
except Exception as e:
    print(json.dumps({'error': str(e)}))
"`;
      
      exec(command, { maxBuffer: 5 * 1024 * 1024 }, (error, stdout, stderr) => {
        try {
          const data = JSON.parse(stdout);
          
          if (data.error) {
            resolve({ error: data.error });
            return;
          }
          
          // استخراج المعلومات المهمة
          const exifInfo = {
            camera: {
              make: data['Image Make'] || null,
              model: data['Image Model'] || null,
              software: data['Image Software'] || null
            },
            location: {
              gps_latitude: data['GPS GPSLatitude'] || null,
              gps_longitude: data['GPS GPSLongitude'] || null,
              gps_altitude: data['GPS GPSAltitude'] || null,
              gps_timestamp: data['GPS GPSTimeStamp'] || null
            },
            datetime: {
              original: data['EXIF DateTimeOriginal'] || null,
              digitized: data['EXIF DateTimeDigitized'] || null,
              modified: data['Image DateTime'] || null
            },
            technical: {
              width: data['EXIF ExifImageWidth'] || data['Image ImageWidth'] || null,
              height: data['EXIF ExifImageLength'] || data['Image ImageLength'] || null,
              orientation: data['Image Orientation'] || null,
              resolution: data['Image XResolution'] || null,
              color_space: data['EXIF ColorSpace'] || null
            },
            settings: {
              iso: data['EXIF ISOSpeedRatings'] || null,
              exposure_time: data['EXIF ExposureTime'] || null,
              f_number: data['EXIF FNumber'] || null,
              focal_length: data['EXIF FocalLength'] || null,
              flash: data['EXIF Flash'] || null
            },
            raw_data: data
          };
          
          resolve(exifInfo);
          
        } catch (parseError) {
          resolve({ error: 'فشل تحليل بيانات EXIF' });
        }
      });
    });
  }

  /**
   * البحث العكسي عن الصورة
   */
  async reverseImageSearch(imagePath, imageUrl) {
    const results = [];
    
    try {
      // Google Reverse Image Search
      const googleResults = await this.googleReverseSearch(imageUrl);
      results.push(...googleResults);
      
      // Yandex Reverse Image Search
      const yandexResults = await this.yandexReverseSearch(imageUrl);
      results.push(...yandexResults);
      
    } catch (error) {
      console.error('Reverse search error:', error);
    }
    
    return results;
  }

  /**
   * البحث العكسي عبر Google
   */
  async googleReverseSearch(imageUrl) {
    try {
      const searchUrl = `https://www.google.com/searchbyimage?image_url=${encodeURIComponent(imageUrl)}`;
      
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 15000
      });
      
      // تحليل النتائج (بسيط)
      const results = [];
      
      // يمكن تحسين هذا باستخدام cheerio لتحليل HTML
      if (response.data.includes('Best guess for this image:')) {
        results.push({
          engine: 'Google',
          type: 'reverse_image_search',
          url: searchUrl,
          found: true
        });
      }
      
      return results;
      
    } catch (error) {
      console.error('Google reverse search error:', error.message);
      return [];
    }
  }

  /**
   * البحث العكسي عبر Yandex
   */
  async yandexReverseSearch(imageUrl) {
    try {
      const searchUrl = `https://yandex.com/images/search?rpt=imageview&url=${encodeURIComponent(imageUrl)}`;
      
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 15000
      });
      
      const results = [];
      
      if (response.status === 200) {
        results.push({
          engine: 'Yandex',
          type: 'reverse_image_search',
          url: searchUrl,
          found: true
        });
      }
      
      return results;
      
    } catch (error) {
      console.error('Yandex reverse search error:', error.message);
      return [];
    }
  }

  /**
   * حفظ نتائج تحليل الصورة
   */
  async saveImageAnalysis(personId, results) {
    this.db.addMetadata(
      personId,
      'image_analysis',
      JSON.stringify({
        url: results.url,
        exif: results.exif,
        reverse_search_count: results.reverseSearch.length,
        analysis_date: new Date().toISOString()
      })
    );
  }

  /**
   * استخراج الموقع الجغرافي من GPS
   */
  parseGPSCoordinates(latitude, longitude) {
    // تحويل إحداثيات GPS إلى صيغة عشرية
    try {
      // هذه دالة مساعدة لتحويل الصيغة
      return {
        lat: this.convertDMSToDD(latitude),
        lng: this.convertDMSToDD(longitude)
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * تحويل DMS إلى Decimal Degrees
   */
  convertDMSToDD(dms) {
    // تنفيذ بسيط - يمكن تحسينه
    if (typeof dms === 'string') {
      const parts = dms.match(/(\d+)[^\d]+(\d+)[^\d]+([\d.]+)/);
      if (parts) {
        const degrees = parseFloat(parts[1]);
        const minutes = parseFloat(parts[2]);
        const seconds = parseFloat(parts[3]);
        return degrees + (minutes / 60) + (seconds / 3600);
      }
    }
    return parseFloat(dms);
  }
}

module.exports = ImageAnalyzer;

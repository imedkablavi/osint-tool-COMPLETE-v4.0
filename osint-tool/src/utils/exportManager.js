const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

/**
 * ExportManager - نظام تصدير شامل للتقارير (PDF, CSV, JSON)
 */
class ExportManager {
  constructor(db) {
    this.db = db;
    this.exportDir = path.join(__dirname, '../../exports');
    
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  /**
   * تصدير تحقيق كامل بجميع الصيغ
   */
  async exportInvestigation(personId, formats = ['json', 'csv', 'pdf']) {
    const results = {
      success: [],
      failed: []
    };

    // جمع جميع البيانات
    const data = await this.gatherInvestigationData(personId);
    
    // تصدير بالصيغ المطلوبة
    for (const format of formats) {
      try {
        let filePath;
        
        switch (format.toLowerCase()) {
          case 'json':
            filePath = await this.exportJSON(personId, data);
            break;
          case 'csv':
            filePath = await this.exportCSV(personId, data);
            break;
          case 'pdf':
            filePath = await this.exportPDF(personId, data);
            break;
          default:
            throw new Error(`صيغة غير مدعومة: ${format}`);
        }
        
        results.success.push({ format, path: filePath });
      } catch (error) {
        results.failed.push({ format, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * جمع جميع بيانات التحقيق
   */
  async gatherInvestigationData(personId) {
    const person = this.db.getPerson(personId);
    const socialAccounts = this.db.getSocialAccountsByPerson(personId);
    const breaches = this.db.getBreachesByPerson(personId);
    const domains = this.db.getDomainsByPerson(personId);
    const edges = this.db.getGraphEdgesByPerson(personId);
    const logs = this.db.getLogsByPerson(personId);
    const metadata = this.db.getMetadataByPerson(personId);
    
    return {
      person,
      socialAccounts,
      breaches,
      domains,
      edges,
      logs,
      metadata,
      exportDate: new Date().toISOString()
    };
  }

  /**
   * تصدير JSON
   */
  async exportJSON(personId, data) {
    const fileName = `investigation_${personId}_${Date.now()}.json`;
    const filePath = path.join(this.exportDir, fileName);
    
    // تنسيق البيانات بشكل جميل
    const jsonData = JSON.stringify(data, null, 2);
    
    fs.writeFileSync(filePath, jsonData, 'utf8');
    
    console.log(`✅ تم تصدير JSON: ${filePath}`);
    return filePath;
  }

  /**
   * تصدير CSV
   */
  async exportCSV(personId, data) {
    const fileName = `investigation_${personId}_${Date.now()}.csv`;
    const filePath = path.join(this.exportDir, fileName);
    
    let csv = '';
    
    // معلومات الشخص
    csv += '=== معلومات الشخص ===\n';
    csv += 'الحقل,القيمة\n';
    csv += `الاسم الكامل,"${data.person.fullname || ''}"\n`;
    csv += `البريد الإلكتروني,"${data.person.email || ''}"\n`;
    csv += `اسم المستخدم,"${data.person.username || ''}"\n`;
    csv += `رقم الهاتف,"${data.person.phone || ''}"\n`;
    csv += '\n';
    
    // الحسابات الاجتماعية
    csv += '=== الحسابات الاجتماعية ===\n';
    csv += 'المنصة,اسم المستخدم,الرابط,مستوى الثقة\n';
    data.socialAccounts.forEach(account => {
      csv += `"${account.platform}","${account.username}","${account.profile_url}",${account.confidence_score}\n`;
    });
    csv += '\n';
    
    // التسريبات
    csv += '=== التسريبات الأمنية ===\n';
    csv += 'اسم التسريب,النطاق,تاريخ التسريب,الوصف\n';
    data.breaches.forEach(breach => {
      const desc = (breach.description || '').replace(/"/g, '""');
      csv += `"${breach.breach_name}","${breach.domain}","${breach.breach_date}","${desc}"\n`;
    });
    csv += '\n';
    
    // النطاقات
    csv += '=== النطاقات ===\n';
    csv += 'النطاق,المالك,تاريخ التسجيل,تاريخ الانتهاء\n';
    data.domains.forEach(domain => {
      csv += `"${domain.domain}","${domain.registrant || ''}","${domain.registration_date || ''}","${domain.expiration_date || ''}"\n`;
    });
    
    fs.writeFileSync(filePath, csv, 'utf8');
    
    console.log(`✅ تم تصدير CSV: ${filePath}`);
    return filePath;
  }

  /**
   * تصدير PDF
   */
  async exportPDF(personId, data) {
    // إنشاء HTML أولاً
    const htmlPath = await this.createHTMLReport(personId, data);
    
    // تحويل HTML إلى PDF باستخدام wkhtmltopdf أو puppeteer
    const fileName = `investigation_${personId}_${Date.now()}.pdf`;
    const pdfPath = path.join(this.exportDir, fileName);
    
    return new Promise((resolve, reject) => {
      // استخدام wkhtmltopdf (يجب أن يكون مثبتاً)
      const command = `wkhtmltopdf --enable-local-file-access "${htmlPath}" "${pdfPath}"`;
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          // إذا فشل wkhtmltopdf، نحاول طريقة بديلة
          console.log('wkhtmltopdf غير متوفر، استخدام طريقة بديلة...');
          this.exportPDFAlternative(htmlPath, pdfPath)
            .then(resolve)
            .catch(reject);
        } else {
          // حذف ملف HTML المؤقت
          fs.unlinkSync(htmlPath);
          
          console.log(`✅ تم تصدير PDF: ${pdfPath}`);
          resolve(pdfPath);
        }
      });
    });
  }

  /**
   * طريقة بديلة لتصدير PDF (باستخدام Python)
   */
  async exportPDFAlternative(htmlPath, pdfPath) {
    return new Promise((resolve, reject) => {
      // استخدام Python مع weasyprint أو pdfkit
      const pythonScript = `
import sys
try:
    from weasyprint import HTML
    HTML('${htmlPath}').write_pdf('${pdfPath}')
    print('success')
except ImportError:
    try:
        import pdfkit
        pdfkit.from_file('${htmlPath}', '${pdfPath}')
        print('success')
    except:
        print('error: no PDF library available')
        sys.exit(1)
`;
      
      const command = `python3 -c "${pythonScript.replace(/\n/g, '; ')}"`;
      
      exec(command, (error, stdout, stderr) => {
        if (error || !stdout.includes('success')) {
          reject(new Error('فشل تصدير PDF - تأكد من تثبيت weasyprint أو pdfkit'));
        } else {
          // حذف ملف HTML المؤقت
          fs.unlinkSync(htmlPath);
          
          console.log(`✅ تم تصدير PDF: ${pdfPath}`);
          resolve(pdfPath);
        }
      });
    });
  }

  /**
   * إنشاء تقرير HTML
   */
  async createHTMLReport(personId, data) {
    const fileName = `report_${personId}_${Date.now()}.html`;
    const filePath = path.join(this.exportDir, fileName);
    
    const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>تقرير التحقيق - ${data.person.fullname || data.person.username}</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            direction: rtl;
            text-align: right;
            margin: 40px;
            color: #333;
        }
        h1 {
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
        }
        h2 {
            color: #34495e;
            margin-top: 30px;
            border-right: 5px solid #3498db;
            padding-right: 10px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: right;
        }
        th {
            background-color: #3498db;
            color: white;
        }
        tr:nth-child(even) {
            background-color: #f2f2f2;
        }
        .info-box {
            background: #ecf0f1;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }
        .info-box strong {
            color: #2c3e50;
        }
        .footer {
            margin-top: 50px;
            text-align: center;
            color: #7f8c8d;
            font-size: 0.9em;
        }
        .confidence-high { color: #27ae60; font-weight: bold; }
        .confidence-medium { color: #f39c12; font-weight: bold; }
        .confidence-low { color: #e74c3c; font-weight: bold; }
    </style>
</head>
<body>
    <h1>🔍 تقرير التحقيق OSINT</h1>
    
    <div class="info-box">
        <strong>تاريخ التصدير:</strong> ${new Date().toLocaleString('ar-EG')}<br>
        <strong>رقم التحقيق:</strong> #${personId}
    </div>
    
    <h2>📋 معلومات الشخص المستهدف</h2>
    <table>
        <tr>
            <th>الحقل</th>
            <th>القيمة</th>
        </tr>
        <tr>
            <td>الاسم الكامل</td>
            <td>${data.person.fullname || '-'}</td>
        </tr>
        <tr>
            <td>البريد الإلكتروني</td>
            <td>${data.person.email || '-'}</td>
        </tr>
        <tr>
            <td>اسم المستخدم</td>
            <td>${data.person.username || '-'}</td>
        </tr>
        <tr>
            <td>رقم الهاتف</td>
            <td>${data.person.phone || '-'}</td>
        </tr>
        <tr>
            <td>تاريخ الإنشاء</td>
            <td>${new Date(data.person.created_at).toLocaleString('ar-EG')}</td>
        </tr>
    </table>
    
    <h2>🌐 الحسابات الاجتماعية (${data.socialAccounts.length})</h2>
    <table>
        <tr>
            <th>المنصة</th>
            <th>اسم المستخدم</th>
            <th>الرابط</th>
            <th>مستوى الثقة</th>
        </tr>
        ${data.socialAccounts.map(account => `
        <tr>
            <td>${account.platform}</td>
            <td>${account.username}</td>
            <td><a href="${account.profile_url}" target="_blank">${account.profile_url}</a></td>
            <td class="${this.getConfidenceClass(account.confidence_score)}">${account.confidence_score}%</td>
        </tr>
        `).join('')}
    </table>
    
    <h2>🔓 التسريبات الأمنية (${data.breaches.length})</h2>
    <table>
        <tr>
            <th>اسم التسريب</th>
            <th>النطاق</th>
            <th>تاريخ التسريب</th>
            <th>الوصف</th>
        </tr>
        ${data.breaches.map(breach => `
        <tr>
            <td>${breach.breach_name}</td>
            <td>${breach.domain}</td>
            <td>${breach.breach_date || '-'}</td>
            <td>${breach.description ? breach.description.substring(0, 100) + '...' : '-'}</td>
        </tr>
        `).join('')}
    </table>
    
    <h2>🌍 النطاقات المرتبطة (${data.domains.length})</h2>
    <table>
        <tr>
            <th>النطاق</th>
            <th>المالك</th>
            <th>تاريخ التسجيل</th>
            <th>تاريخ الانتهاء</th>
        </tr>
        ${data.domains.map(domain => `
        <tr>
            <td>${domain.domain}</td>
            <td>${domain.registrant || '-'}</td>
            <td>${domain.registration_date || '-'}</td>
            <td>${domain.expiration_date || '-'}</td>
        </tr>
        `).join('')}
    </table>
    
    <h2>🔗 شبكة العلاقات</h2>
    <p>تم اكتشاف <strong>${data.edges.length}</strong> علاقة بين الكيانات المختلفة.</p>
    
    <div class="footer">
        <p>تم إنشاء هذا التقرير بواسطة OSINT Tool</p>
        <p>⚠️ هذا التقرير للأغراض التعليمية والبحثية فقط</p>
    </div>
</body>
</html>
`;
    
    fs.writeFileSync(filePath, html, 'utf8');
    return filePath;
  }

  /**
   * الحصول على class CSS حسب مستوى الثقة
   */
  getConfidenceClass(confidence) {
    if (confidence >= 80) return 'confidence-high';
    if (confidence >= 50) return 'confidence-medium';
    return 'confidence-low';
  }

  /**
   * تصدير الرسم البياني كصورة
   */
  async exportGraphImage(personId) {
    // هذه الميزة تتطلب تكامل مع vis.js أو استخدام puppeteer
    console.log('تصدير الرسم البياني كصورة - قيد التطوير');
    return null;
  }

  /**
   * الحصول على قائمة الملفات المصدرة
   */
  getExportedFiles() {
    try {
      const files = fs.readdirSync(this.exportDir);
      return files.map(file => ({
        name: file,
        path: path.join(this.exportDir, file),
        size: fs.statSync(path.join(this.exportDir, file)).size,
        created: fs.statSync(path.join(this.exportDir, file)).mtime
      }));
    } catch (error) {
      console.error('Error getting exported files:', error);
      return [];
    }
  }

  /**
   * حذف ملف مصدر
   */
  deleteExportedFile(fileName) {
    try {
      const filePath = path.join(this.exportDir, fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }
}

module.exports = ExportManager;

const BaseCollector = require('./baseCollector');
const cheerio = require('cheerio');

class SocialMediaCollector extends BaseCollector {
  constructor(db) {
    super('SocialMediaCollector', db);
    
    // قائمة المنصات الاجتماعية الرئيسية
    this.platforms = [
      {
        name: 'GitHub',
        urlPattern: 'https://github.com/{username}',
        checkPattern: 'github.com',
        icon: '🐙'
      },
      {
        name: 'Twitter',
        urlPattern: 'https://twitter.com/{username}',
        checkPattern: 'twitter.com',
        icon: '🐦'
      },
      {
        name: 'Instagram',
        urlPattern: 'https://instagram.com/{username}',
        checkPattern: 'instagram.com',
        icon: '📷'
      },
      {
        name: 'Facebook',
        urlPattern: 'https://facebook.com/{username}',
        checkPattern: 'facebook.com',
        icon: '👤'
      },
      {
        name: 'LinkedIn',
        urlPattern: 'https://linkedin.com/in/{username}',
        checkPattern: 'linkedin.com',
        icon: '💼'
      },
      {
        name: 'Reddit',
        urlPattern: 'https://reddit.com/user/{username}',
        checkPattern: 'reddit.com',
        icon: '🤖'
      },
      {
        name: 'YouTube',
        urlPattern: 'https://youtube.com/@{username}',
        checkPattern: 'youtube.com',
        icon: '📺'
      },
      {
        name: 'TikTok',
        urlPattern: 'https://tiktok.com/@{username}',
        checkPattern: 'tiktok.com',
        icon: '🎵'
      },
      {
        name: 'Telegram',
        urlPattern: 'https://t.me/{username}',
        checkPattern: 't.me',
        icon: '✈️'
      },
      {
        name: 'Medium',
        urlPattern: 'https://medium.com/@{username}',
        checkPattern: 'medium.com',
        icon: '📝'
      },
      {
        name: 'Twitch',
        urlPattern: 'https://twitch.tv/{username}',
        checkPattern: 'twitch.tv',
        icon: '🎮'
      },
      {
        name: 'Pinterest',
        urlPattern: 'https://pinterest.com/{username}',
        checkPattern: 'pinterest.com',
        icon: '📌'
      },
      {
        name: 'Snapchat',
        urlPattern: 'https://snapchat.com/add/{username}',
        checkPattern: 'snapchat.com',
        icon: '👻'
      },
      {
        name: 'Discord',
        urlPattern: 'https://discord.com/users/{username}',
        checkPattern: 'discord.com',
        icon: '💬'
      },
      {
        name: 'Spotify',
        urlPattern: 'https://open.spotify.com/user/{username}',
        checkPattern: 'spotify.com',
        icon: '🎧'
      }
    ];
  }

  async collect(personId, searchData) {
    await this.log(personId, 'INFO', 'بدء البحث عن الحسابات الاجتماعية');
    
    const results = [];
    const username = searchData.username;

    if (!username) {
      await this.log(personId, 'WARNING', 'لم يتم توفير اسم مستخدم للبحث');
      return results;
    }

    for (const platform of this.platforms) {
      try {
        const url = platform.urlPattern.replace('{username}', username);
        await this.log(personId, 'INFO', `فحص ${platform.name}: ${url}`);

        const exists = await this.checkAccountExists(url, platform);
        
        if (exists) {
          const accountData = {
            platform: platform.name,
            username: username,
            profileUrl: url,
            verified: false,
            confidenceScore: 70.0,
            additionalData: {
              icon: platform.icon,
              checkMethod: 'url_check'
            }
          };

          const accountId = this.db.addSocialAccount(personId, accountData);
          results.push({ ...accountData, id: accountId });
          
          await this.log(personId, 'SUCCESS', `تم العثور على حساب على ${platform.name}`);
        } else {
          await this.log(personId, 'INFO', `لم يتم العثور على حساب على ${platform.name}`);
        }

        // تأخير بسيط لتجنب الحظر
        await this.sleep(500);
      } catch (error) {
        await this.log(personId, 'ERROR', `خطأ في فحص ${platform.name}: ${error.message}`);
      }
    }

    await this.log(personId, 'SUCCESS', `تم الانتهاء من البحث. تم العثور على ${results.length} حساب`);
    return results;
  }

  async checkAccountExists(url, platform) {
    try {
      const response = await this.makeRequest(url, {
        validateStatus: (status) => status < 500
      });

      // فحص حالة الاستجابة
      if (response.status === 200) {
        const html = response.data;
        
        // فحص إذا كانت الصفحة تحتوي على علامات تدل على وجود الحساب
        if (typeof html === 'string') {
          const lowerHtml = html.toLowerCase();
          
          // تجنب صفحات الخطأ
          if (lowerHtml.includes('page not found') || 
              lowerHtml.includes('404') ||
              lowerHtml.includes('user not found') ||
              lowerHtml.includes('this account doesn\'t exist')) {
            return false;
          }

          // البحث عن علامات إيجابية
          if (lowerHtml.includes(platform.checkPattern) ||
              lowerHtml.includes('profile') ||
              lowerHtml.includes('followers')) {
            return true;
          }
        }
        
        return true;
      } else if (response.status === 404) {
        return false;
      }

      return false;
    } catch (error) {
      // في حالة الخطأ، نعتبر أن الحساب غير موجود
      return false;
    }
  }

  async extractProfileData(html, platform) {
    const $ = cheerio.load(html);
    const data = {};

    // محاولة استخراج بيانات أساسية (يختلف حسب كل منصة)
    try {
      // هذا مثال عام، كل منصة تحتاج لمعالجة خاصة
      data.displayName = $('meta[property="og:title"]').attr('content') || 
                         $('title').text().trim();
      data.bio = $('meta[property="og:description"]').attr('content') || '';
      data.avatarUrl = $('meta[property="og:image"]').attr('content') || '';
    } catch (error) {
      // تجاهل الأخطاء في الاستخراج
    }

    return data;
  }
}

module.exports = SocialMediaCollector;

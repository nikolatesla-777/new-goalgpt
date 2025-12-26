# 🚀 DigitalOcean App Platform Setup Guide

**Date:** 24 Aralık 2025  
**Repository:** https://github.com/nikolatesla-777/new-goalgpt

---

## 📋 ADIMLAR

### 1. DigitalOcean Hesabı Oluştur
- [ ] https://www.digitalocean.com → Sign up
- [ ] Email verification
- [ ] Payment method ekle (credit card)

### 2. App Platform'da Yeni App Oluştur

#### 2.1 GitHub Repository Bağlama
1. DigitalOcean Dashboard → **Apps** → **Create App**
2. **GitHub** seçeneğini seç
3. GitHub hesabını bağla (authorize)
4. Repository seç: **nikolatesla-777/new-goalgpt**
5. Branch seç: **main**
6. **Next** tıkla

#### 2.2 Build & Run Settings
**Build Command:**
```bash
npm install
```

**Run Command:**
```bash
npm start
```

**Source Directory:** (boş bırak - root)

**Environment:** `Node.js`
**Buildpack:** `Node.js` (auto-detect)

#### 2.3 Resource Configuration
- **Plan:** Basic ($5/month) veya Professional
- **Instance Size:** 512MB RAM (başlangıç için yeterli)
- **Instance Count:** 1 (auto-scaling sonra eklenebilir)

### 3. Environment Variables Ekle

**DigitalOcean App Platform → Settings → App-Level Environment Variables:**

```env
# Database (Supabase - şimdilik placeholder, sonra ekleyeceğiz)
DB_HOST=placeholder
DB_PORT=6543
DB_NAME=postgres
DB_USER=placeholder
DB_PASSWORD=placeholder
DB_MAX_CONNECTIONS=20

# TheSports API
THESPORTS_API_BASE_URL=https://api.thesports.com/v1/football
THESPORTS_API_SECRET=3205e4f6efe04a03f0055152c4aa0f37
THESPORTS_API_USER=goalgpt

# Server
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
```

**⚠️ ÖNEMLİ:** Database credentials'ları şimdilik placeholder bırak, Supabase setup'tan sonra güncelleyeceğiz.

### 4. Static IP / Outbound IP Kontrolü

#### 4.1 App Platform Outbound IP
DigitalOcean App Platform'un outbound IP'si **değişken** olabilir. Kontrol etmek için:

1. App deploy edildikten sonra
2. App içinde bir endpoint oluştur:
   ```typescript
   // Test endpoint for IP check
   fastify.get('/api/test-ip', async (request, reply) => {
     const ip = await fetch('https://api.thesports.com/v1/ip/demo').then(r => r.json());
     return { outbound_ip: ip.results?.request_ip || ip.ip };
   });
   ```
3. Bu endpoint'i çağır ve IP'yi al
4. IP'yi TheSports API whitelist'e ekle

#### 4.2 Alternatif: Droplet Kullan (Static IP garantisi)
Eğer App Platform outbound IP değişkense, **Droplet** kullan:
- Droplet → Static IP garantisi
- Manual deployment (PM2/systemd)

### 5. Deploy & Test

#### 5.1 İlk Deploy
1. **Create Resources** tıkla
2. Deploy başlar (5-10 dakika)
3. Deploy loglarını kontrol et

#### 5.2 Deploy Sonrası Test
```bash
# App URL'i al (DigitalOcean otomatik verir)
# Örnek: https://new-goalgpt-xxxxx.ondigitalocean.app

# Health check
curl https://[APP_URL]/health

# API test
curl https://[APP_URL]/api/matches/recent
```

### 6. Auto-Deploy Ayarları

#### 6.1 GitHub Push = Auto Deploy
- ✅ Varsayılan olarak aktif
- Her `git push origin main` → Otomatik deploy

#### 6.2 Manual Deploy
- App Platform → **Deployments** → **Create Deployment**
- Branch seç → Deploy

---

## 🔧 TROUBLESHOOTING

### Build Hatası
**Sorun:** `npm install` başarısız
**Çözüm:**
- `package.json` kontrol et
- Node.js version uyumlu mu? (`.nvmrc` dosyası var mı?)

### Runtime Hatası
**Sorun:** App başlamıyor
**Çözüm:**
- Logs kontrol et: App Platform → **Runtime Logs**
- `npm start` komutu doğru mu?
- Environment variables eksik mi?

### Database Connection Hatası
**Sorun:** Database bağlanamıyor
**Çözüm:**
- Supabase connection string doğru mu?
- SSL ayarları doğru mu?
- IP whitelist (Supabase'de)

### TheSports API IP Hatası
**Sorun:** "IP is not authorized"
**Çözüm:**
1. Outbound IP'yi kontrol et (`/api/test-ip` endpoint)
2. IP'yi TheSports whitelist'e ekle
3. 5-10 dakika bekle (whitelist propagation)

---

## 📝 CHECKLIST

### DigitalOcean Setup
- [ ] DigitalOcean hesabı oluşturuldu
- [ ] App Platform'da yeni app oluşturuldu
- [ ] GitHub repository bağlandı
- [ ] Build/Run commands ayarlandı
- [ ] Environment variables eklendi (placeholder DB)
- [ ] İlk deploy başarılı
- [ ] App URL çalışıyor
- [ ] Outbound IP tespit edildi
- [ ] TheSports API IP whitelist'e eklendi

### Sonraki Adımlar
- [ ] Supabase projesi oluştur (sonraki adım)
- [ ] Database migration yap
- [ ] Environment variables güncelle (Supabase credentials)
- [ ] Final test

---

## 🎯 SONRAKI ADIM: SUPABASE

DigitalOcean App Platform hazır olduktan sonra:
1. Supabase projesi oluştur
2. Database schema import et
3. Connection string'i al
4. DigitalOcean environment variables güncelle
5. Final deploy & test

---

## 📚 KAYNAKLAR

- [DigitalOcean App Platform Docs](https://docs.digitalocean.com/products/app-platform/)
- [App Platform Environment Variables](https://docs.digitalocean.com/products/app-platform/how-to/use-environment-variables/)
- [App Platform Buildpacks](https://docs.digitalocean.com/products/app-platform/how-to/use-buildpacks/)





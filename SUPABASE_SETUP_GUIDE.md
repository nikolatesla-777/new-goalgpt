# 🗄️ Supabase Setup Guide

**Date:** 24 Aralık 2025  
**Project:** nikolatesla-777's Project  
**Project URL:** `https://wakbsxzocfpngywyzdml.supabase.co`

---

## 📋 ADIM 1: Connection String Alma

### 1.1 Supabase Dashboard'a Git
1. https://supabase.com/dashboard → Projenizi açın
2. Sol menüden **"Settings"** (⚙️) tıkla
3. **"Database"** sekmesine git

### 1.2 Connection String Bul
**Connection Pooling (Recommended):**
- **Host:** `aws-0-[REGION].pooler.supabase.com`
- **Port:** `6543` (Transaction mode - pgbouncer)
- **Database:** `postgres`
- **User:** `postgres.wakbsxzocfpngywyzdml`
- **Password:** [Supabase dashboard'dan al]

**Connection String Format:**
```
postgresql://postgres.wakbsxzocfpngywyzdml:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
```

**Direct Connection (Migrations için):**
- **Port:** `5432` (Direct connection)
- **Connection String:**
```
postgresql://postgres.wakbsxzocfpngywyzdml:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
```

### 1.3 Password Alma
1. Settings → Database → **"Database password"** bölümü
2. Eğer password yoksa, **"Reset database password"** tıkla
3. Yeni password oluştur ve kaydet

---

## 📋 ADIM 2: Database Schema Import

### 2.1 Mevcut Database Schema Export
VPS'te veya local'de mevcut database'den schema export et:

```bash
# Eğer mevcut database'e erişiminiz varsa:
pg_dump -h [ESKI_DB_HOST] -U [USER] -d [DB_NAME] --schema-only > schema.sql
```

**VEYA** mevcut schema'yı manuel oluştur (migration dosyalarından).

### 2.2 Supabase'e Schema Import

#### Yöntem 1: Supabase SQL Editor
1. Supabase Dashboard → Sol menüden **"SQL Editor"** tıkla
2. **"New query"** tıkla
3. Schema SQL'ini yapıştır
4. **"Run"** tıkla

#### Yöntem 2: psql Command Line
```bash
# Direct connection ile (port 5432)
psql "postgresql://postgres.wakbsxzocfpngywyzdml:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres" < schema.sql
```

---

## 📋 ADIM 3: Environment Variables Güncelle

### 3.1 VPS'te .env Dosyasını Düzenle
```bash
cd /var/www/goalgpt
nano .env
```

### 3.2 .env İçeriğini Güncelle
```env
# Database (Supabase)
DB_HOST=aws-0-[REGION].pooler.supabase.com
DB_PORT=6543
DB_NAME=postgres
DB_USER=postgres.wakbsxzocfpngywyzdml
DB_PASSWORD=[SUPABASE_PASSWORD]
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

**⚠️ ÖNEMLİ:** `[REGION]` kısmını Supabase dashboard'dan alın (örn: `eu-central-1`, `us-east-1`)

---

## 📋 ADIM 4: PM2 Restart

```bash
cd /var/www/goalgpt
pm2 restart goalgpt-backend
pm2 logs goalgpt-backend --lines 50
```

---

## 📋 ADIM 5: Test

### 5.1 Database Connection Test
```bash
# VPS'te
curl http://localhost:3000/api/health
```

### 5.2 API Test
```bash
curl http://localhost:3000/api/matches/recent
```

---

## 🔍 TROUBLESHOOTING

### Connection String Bulamıyorum
1. Settings → Database → **"Connection string"** bölümü
2. **"URI"** veya **"Connection pooling"** seçeneğini kullan

### Region Bulamıyorum
- Connection string'de `aws-0-[REGION]` kısmına bakın
- Örnek: `aws-0-eu-central-1` → Region: `eu-central-1`

### Schema Import Hatası
- SQL Editor'de syntax hatası var mı kontrol edin
- Table'lar zaten var mı kontrol edin (DROP TABLE IF EXISTS kullanın)

---

## 📝 CHECKLIST

- [ ] Supabase project oluşturuldu
- [ ] Connection string alındı
- [ ] Database password oluşturuldu
- [ ] Schema import edildi
- [ ] .env dosyası güncellendi
- [ ] PM2 restart yapıldı
- [ ] Database connection test edildi
- [ ] API test edildi

---

## 🎯 SONRAKI ADIMLAR

1. ✅ Supabase setup tamamlandı
2. ⏭️ Database migration (eğer production data varsa)
3. ⏭️ Final test
4. ⏭️ Monitoring setup






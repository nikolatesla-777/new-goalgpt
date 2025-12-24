# 🔗 Supabase Connection String Bulma Rehberi

**Date:** 24 Aralık 2025  
**Project:** nikolatesla-777's Project

---

## 📍 Connection String Nerede?

Supabase'de connection string'i bulmanın **2 yolu** var:

### ✅ YOL 1: Settings → Database → Connection string (ÖNERİLEN)

1. **Sol menüden "Settings" (⚙️) tıkla**
2. **"Database" sekmesine git**
3. **"Connection string" veya "Connection pooling" bölümünü bul**
4. **"URI" veya "Connection pooling" seçeneğini seç**

**Görünmesi gereken format:**
```
postgresql://postgres.wakbsxzocfpngywyzdml:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
```

**VEYA**

```
postgresql://postgres:[PASSWORD]@db.wakbsxzocfpngywyzdml.supabase.co:5432/postgres
```

---

### ✅ YOL 2: Settings → API → Database

1. **Sol menüden "Settings" (⚙️) tıkla**
2. **"API" sekmesine git**
3. **"Database" bölümünü bul**
4. **Connection string orada olmalı**

---

## 🔍 Eğer Connection String Görünmüyorsa

### Adım 1: Database Password Oluştur

1. **Settings → Database → "Database password" bölümü**
2. **"Reset database password" butonuna tıkla**
3. **Yeni password oluştur ve kaydet**

### Adım 2: Connection String Formatını Manuel Oluştur

Supabase connection string formatı:

**Connection Pooling (Önerilen - Port 6543):**
```
postgresql://postgres.wakbsxzocfpngywyzdml:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
```

**Direct Connection (Migrations için - Port 5432):**
```
postgresql://postgres.wakbsxzocfpngywyzdml:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
```

**VEYA (Eğer farklı format kullanılıyorsa):**
```
postgresql://postgres:[PASSWORD]@db.wakbsxzocfpngywyzdml.supabase.co:5432/postgres
```

---

## 📋 Bilgileri Toplama

Connection string'i oluşturmak için şunlara ihtiyacın var:

1. **Project URL:** `https://wakbsxzocfpngywyzdml.supabase.co` ✅ (Bunu biliyoruz)
2. **Database Password:** Settings → Database → "Reset database password" ile oluştur
3. **Region:** Connection string'de `aws-0-[REGION]` kısmından anlaşılır
   - Örnek: `aws-0-eu-central-1` → Region: `eu-central-1`
   - Örnek: `aws-0-us-east-1` → Region: `us-east-1`

---

## 🎯 Hızlı Test

Connection string'i bulduktan sonra test et:

```bash
# VPS'te veya local'de
psql "postgresql://postgres.wakbsxzocfpngywyzdml:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
```

**Başarılı olursa:** PostgreSQL prompt'u görürsün (`postgres=>`)

---

## 📝 .env Dosyası İçin Ayrıştırılmış Format

Connection string'i `.env` dosyasına ayrıştırılmış olarak da ekleyebilirsin:

```env
# Supabase Database (Connection Pooling - Port 6543)
DB_HOST=aws-0-[REGION].pooler.supabase.com
DB_PORT=6543
DB_NAME=postgres
DB_USER=postgres.wakbsxzocfpngywyzdml
DB_PASSWORD=[PASSWORD]

# VEYA Direct Connection (Port 5432 - Migrations için)
# DB_HOST=aws-0-[REGION].pooler.supabase.com
# DB_PORT=5432
# DB_NAME=postgres
# DB_USER=postgres.wakbsxzocfpngywyzdml
# DB_PASSWORD=[PASSWORD]
```

---

## ❓ Hala Bulamıyorsan

1. **Supabase Dashboard → Sol üst köşe → "Project Settings"**
2. **"Database" sekmesi**
3. **"Connection string" veya "Connection info" bölümü**

VEYA

1. **Supabase Dashboard → "SQL Editor"**
2. **Sağ üst köşede "Connect" butonu**
3. **Connection string orada gösterilir**

---

## 🚀 Sonraki Adım

Connection string'i bulduktan sonra:

1. ✅ `SUPABASE_SCHEMA.sql` dosyasını Supabase SQL Editor'e import et
2. ✅ VPS'te `.env` dosyasını güncelle
3. ✅ PM2 restart

---

## 📞 Yardım

Eğer hala bulamıyorsan:
- Supabase Dashboard'da "Help" butonuna tıkla
- VEYA bana connection string formatını gönder, ben senin için `.env` dosyasını hazırlayayım



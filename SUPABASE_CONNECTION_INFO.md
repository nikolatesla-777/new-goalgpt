# 🔗 Supabase Connection Information

**Date:** 24 Aralık 2025  
**Project:** nikolatesla-777's Project  
**Project URL:** `https://wakbsxzocfpngywyzdml.supabase.co`

---

## 📋 Connection Details

- **Region:** `eu-central-1`
- **Database Password:** `fH1MyVUk0h7a0t14`
- **Project Reference:** `wakbsxzocfpngywyzdml`

---

## 🔗 Connection Strings

### Connection Pooling (Önerilen - Port 6543)

**URI Format:**
```
postgresql://postgres.wakbsxzocfpngywyzdml:fH1MyVUk0h7a0t14@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

**Ayrıştırılmış Format (.env için):**
```env
DB_HOST=aws-0-eu-central-1.pooler.supabase.com
DB_PORT=6543
DB_NAME=postgres
DB_USER=postgres.wakbsxzocfpngywyzdml
DB_PASSWORD=fH1MyVUk0h7a0t14
```

---

### Direct Connection (Migrations için - Port 5432)

**URI Format:**
```
postgresql://postgres.wakbsxzocfpngywyzdml:fH1MyVUk0h7a0t14@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
```

**Ayrıştırılmış Format (.env için):**
```env
DB_HOST=aws-0-eu-central-1.pooler.supabase.com
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres.wakbsxzocfpngywyzdml
DB_PASSWORD=fH1MyVUk0h7a0t14
```

---

## ✅ Test Connection

### VPS'te Test Et:
```bash
# Connection Pooling (Port 6543)
psql "postgresql://postgres.wakbsxzocfpngywyzdml:fH1MyVUk0h7a0t14@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direct Connection (Port 5432)
psql "postgresql://postgres.wakbsxzocfpngywyzdml:fH1MyVUk0h7a0t14@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"
```

**Başarılı olursa:** PostgreSQL prompt'u görürsün (`postgres=>`)

---

## 📝 VPS .env Dosyası

VPS'te `/var/www/goalgpt/.env` dosyasını şu şekilde güncelle:

```env
# Database (Supabase - Connection Pooling)
DB_HOST=aws-0-eu-central-1.pooler.supabase.com
DB_PORT=6543
DB_NAME=postgres
DB_USER=postgres.wakbsxzocfpngywyzdml
DB_PASSWORD=fH1MyVUk0h7a0t14
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

---

## 🚀 Sonraki Adımlar

1. ✅ Connection string hazır
2. ⏭️ Supabase SQL Editor → `SUPABASE_SCHEMA.sql` import et
3. ⏭️ VPS'te `.env` dosyasını güncelle
4. ⏭️ PM2 restart
5. ⏭️ Test et

---

## ⚠️ Güvenlik Notu

Bu dosya connection bilgilerini içeriyor. **Git'e commit etme!**


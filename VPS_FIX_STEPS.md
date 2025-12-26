# 🔧 VPS Connection Fix - Adım Adım

**Tarih:** 24 Aralık 2025  
**Sorun:** "Tenant or user not found" hatası  
**Durum:** Supabase connection test edilecek

---

## 📋 ADIM 1: Code Güncelle

VPS terminal'inde:

```bash
cd /var/www/goalgpt
git pull origin main
```

---

## 📋 ADIM 2: Connection Test

```bash
bash VPS_CONNECTION_TEST.sh
```

**Beklenen sonuç:**
- ✅ Connection başarılı → PostgreSQL version görünmeli
- ❌ Connection hatası → Hata mesajını not et

---

## 📋 ADIM 3A: Eğer Test Başarısız Olursa - Direct Connection Dene

`.env` dosyasını düzenle:

```bash
nano /var/www/goalgpt/.env
```

**Mevcut (Connection Pooling - Port 6543):**
```env
DB_HOST=aws-0-eu-central-1.pooler.supabase.com
DB_PORT=6543
DB_NAME=postgres
DB_USER=postgres.wakbsxzocfpngywyzdml
DB_PASSWORD=fH1MyVUk0h7a0t14
```

**Yeni (Direct Connection - Port 5432):**
```env
DB_HOST=aws-0-eu-central-1.pooler.supabase.com
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres.wakbsxzocfpngywyzdml
DB_PASSWORD=fH1MyVUk0h7a0t14
```

**Değişiklik:** Sadece `DB_PORT=5432` (6543 yerine)

Kaydet: `Ctrl+X`, `Y`, `Enter`

---

## 📋 ADIM 3B: Alternatif - Supabase Dashboard'dan Connection String Kontrol

1. Supabase Dashboard → Settings → Database
2. **"Connection string"** veya **"Connection pooling"** bölümünü bul
3. **"URI"** formatını kopyala
4. Format şöyle olmalı:
   ```
   postgresql://postgres.wakbsxzocfpngywyzdml:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true
   ```
   VEYA
   ```
   postgresql://postgres:[PASSWORD]@db.wakbsxzocfpngywyzdml.supabase.co:5432/postgres
   ```

**Eğer farklı bir format görüyorsan, onu kullan!**

---

## 📋 ADIM 4: PM2 Restart

```bash
pm2 restart goalgpt-backend --update-env
pm2 logs goalgpt-backend --lines 50
```

**Beklenen sonuç:**
- ✅ "Database connection test:" mesajı görünmeli
- ❌ "Tenant or user not found" hatası → ADIM 3B'ye git

---

## 📋 ADIM 5: API Test

```bash
curl http://localhost:3000/api/health
```

**Beklenen sonuç:**
```json
{
  "status": "ok",
  "database": "connected"
}
```

---

## 🔍 Sorun Giderme

### "Tenant or user not found" hatası devam ediyorsa:

1. **Supabase Dashboard → Settings → Database → "Database password"**
   - Password'u reset et
   - Yeni password'u `.env` dosyasına ekle

2. **Connection string formatını kontrol et:**
   - Supabase Dashboard'dan **tam connection string**'i kopyala
   - Formatı parse et ve `.env` dosyasına ekle

3. **Direct connection (port 5432) dene:**
   - Connection pooling yerine direct connection kullan
   - `.env` dosyasında `DB_PORT=5432` yap

---

## ✅ Başarı Kriterleri

- [ ] `VPS_CONNECTION_TEST.sh` başarılı
- [ ] PM2 logs'da "Database connection test:" mesajı var
- [ ] `/api/health` endpoint'i `"database": "connected"` döndürüyor
- [ ] "Tenant or user not found" hatası yok




# 🔍 Supabase Connection String Kontrol Rehberi

**Tarih:** 24 Aralık 2025  
**Sorun:** "Tenant or user not found" hatası devam ediyor

---

## 📋 ADIM 1: Supabase Dashboard'dan Tam Connection String Al

### 1.1 Supabase Dashboard'a Git
1. https://supabase.com/dashboard → Projenizi açın
2. Sol menüden **"Settings"** (⚙️) tıkla
3. **"Database"** sekmesine git

### 1.2 Connection String Modal'ını Aç
1. **"Connect to your project"** butonuna tıkla (veya benzer bir buton)
2. **"Connection String"** sekmesine git
3. **"Connection Pooling"** sekmesine git (Direct connection değil!)

### 1.3 Connection Pooling String'ini Kopyala
**ÖNEMLİ:** Connection Pooling sekmesinden tam string'i kopyala.

**Beklenen format (örnek):**
```
postgresql://postgres.wakbsxzocfpngywyzdml:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

**VEYA farklı bir format olabilir:**
```
postgresql://postgres.wakbsxzocfpngywyzdml:[PASSWORD]@[DIFFERENT_HOST]:6543/postgres?pgbouncer=true
```

---

## 📋 ADIM 2: Connection String'i Parse Et

Connection string'den şu bilgileri çıkar:

**Örnek:**
```
postgresql://postgres.wakbsxzocfpngywyzdml:fH1MyVUk0h7a0t14@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

**Parse edilmiş:**
- **Host:** `aws-0-eu-central-1.pooler.supabase.com`
- **Port:** `6543`
- **Database:** `postgres`
- **User:** `postgres.wakbsxzocfpngywyzdml`
- **Password:** `fH1MyVUk0h7a0t14`

---

## 📋 ADIM 3: .env Dosyasını Güncelle

VPS'te `.env` dosyasını bu bilgilerle güncelle:

```env
DB_HOST=[HOST_FROM_CONNECTION_STRING]
DB_PORT=[PORT_FROM_CONNECTION_STRING]
DB_NAME=postgres
DB_USER=[USER_FROM_CONNECTION_STRING]
DB_PASSWORD=[PASSWORD_FROM_CONNECTION_STRING]
DB_MAX_CONNECTIONS=20
```

---

## ⚠️ ÖNEMLİ NOTLAR

1. **Connection Pooling vs Direct Connection:**
   - **Connection Pooling:** IPv4 compatible, production için önerilen
   - **Direct Connection:** IPv6 kullanabilir, ENETUNREACH hatası verebilir

2. **User Format:**
   - Connection Pooling: `postgres.wakbsxzocfpngywyzdml` (project reference ile)
   - Direct Connection: `postgres` (sadece postgres)

3. **Host Format:**
   - Connection Pooling: `aws-0-eu-central-1.pooler.supabase.com` (pooler)
   - Direct Connection: `db.wakbsxzocfpngywyzdml.supabase.co` (db)

---

## 🔍 Kontrol Listesi

- [ ] Supabase Dashboard → Settings → Database
- [ ] "Connect to your project" butonuna tıkla
- [ ] "Connection String" sekmesi
- [ ] **"Connection Pooling"** sekmesi (Direct connection değil!)
- [ ] Tam connection string'i kopyala
- [ ] Parse et ve `.env` dosyasına ekle
- [ ] Test et


# 📋 Supabase Schema Import Rehberi

**Tarih:** 24 Aralık 2025  
**Sorun:** `relation "matches" does not exist` - Schema import edilmemiş

---

## 🔍 Sorun

Database'de tablolar yok:
- `matches` tablosu yok
- Diğer tablolar da muhtemelen yok

---

## ✅ Çözüm: Schema Import

### Yöntem 1: Supabase SQL Editor (ÖNERİLEN)

1. **Supabase Dashboard'a Git**
   - https://supabase.com/dashboard
   - Projenizi açın

2. **SQL Editor'ü Aç**
   - Sol menüden **"SQL Editor"** tıkla
   - **"New query"** butonuna tıkla

3. **Schema SQL'ini Yapıştır**
   - `SUPABASE_SCHEMA.sql` dosyasını aç
   - Tüm içeriği kopyala
   - SQL Editor'e yapıştır

4. **Run**
   - **"Run"** butonuna tıkla (veya `Ctrl+Enter`)
   - Schema import edilecek

5. **Kontrol Et**
   - SQL Editor'de şu sorguyu çalıştır:
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   ORDER BY table_name;
   ```
   - `matches`, `teams`, `competitions` gibi tablolar görünmeli

---

### Yöntem 2: psql Command Line (Alternatif)

VPS'te (eğer psql yüklüyse):

```bash
cd /var/www/goalgpt

# Connection string ile schema import
psql "postgresql://postgres.wakbsxzocfpngywyzdml:fH1MyVUk0h7a0t14@aws-1-eu-central-1.pooler.supabase.com:6543/postgres" < SUPABASE_SCHEMA.sql
```

**NOT:** Connection pooling (port 6543) ile bazı SQL komutları çalışmayabilir. Direct connection (port 5432) gerekebilir.

---

## 📋 Schema Import Sonrası Kontrol

VPS'te:

```bash
cd /var/www/goalgpt
bash VPS_BOOTSTRAP_CHECK.sh
```

**Beklenen sonuç:**
- `Total matches: [sayı]` (0'dan büyük olmalı)
- `Today matches: [sayı]`
- `Live matches: [sayı]`

---

## ⚠️ Önemli Notlar

1. **Schema Import Sırası:**
   - Önce tablolar oluşturulur
   - Sonra index'ler
   - Sonra foreign key'ler

2. **Hata Durumunda:**
   - SQL Editor'de hata mesajlarını kontrol et
   - Eksik tabloları manuel oluştur

3. **Bootstrap:**
   - Schema import sonrası PM2 restart gerekebilir
   - Bootstrap otomatik çalışacak

---

## ✅ Başarı Kriterleri

- [ ] Schema import başarılı
- [ ] `matches` tablosu var
- [ ] `VPS_BOOTSTRAP_CHECK.sh` match sayıları gösteriyor
- [ ] `/api/matches/recent` endpoint data döndürüyor




# 🔄 Bootstrap Nedir? Ne Yapıyor?

**Tarih:** 24 Aralık 2025  
**Durum:** Bootstrap çalışıyor

---

## 🎯 Bootstrap Ne Yapıyor?

Bootstrap, backend server ilk açıldığında **otomatik olarak çalışan bir sync işlemi**.

### 1. Master Data Sync (Temel Veriler)

TheSports API'den çekip **Supabase database'ine kaydediyor:**

- ✅ **Categories** (Kategoriler) - Futbol, Basketbol, vb.
- ✅ **Countries** (Ülkeler) - Türkiye, İngiltere, vb.
- ✅ **Competitions** (Ligler) - Süper Lig, Premier League, vb.
- ✅ **Teams** (Takımlar) - Galatasaray, Fenerbahçe, vb.
- ✅ **Stages** (Aşamalar) - Regular Season, Playoffs, vb.
- ✅ **Seasons** (Sezonlar) - 2024-2025, vb.
- ✅ **Coaches** (Antrenörler)
- ✅ **Players** (Oyuncular)
- ✅ **Referees** (Hakemler)
- ✅ **Venues** (Stadyumlar)

### 2. Matches Sync (Maçlar)

- ✅ **Today's Matches** (Bugünün maçları) - `/match/diary` endpoint'inden
- ✅ **Recent Matches** (Son maçlar) - `/match/recent/list` endpoint'inden
- ✅ **Live Matches** (Canlı maçlar) - `/match/detail_live` endpoint'inden

---

## 📊 Şu An Ne Oluyor?

### ✅ Tamamlananlar:
1. **Schema Import:** Supabase'de 31 tablo oluşturuldu
2. **Database Connection:** Backend Supabase'e bağlandı
3. **Bootstrap Başladı:** Master data sync ediliyor

### ⏳ Devam Edenler:
1. **Stages Sync:** ✅ Çalışıyor (page 4, page 5)
2. **Teams Sync:** ✅ Çalışıyor (rate limit nedeniyle yavaş)
3. **Coaches Sync:** ✅ Çalışıyor
4. **Matches Sync:** ⏳ Henüz başlamadı (master data tamamlandıktan sonra başlayacak)

---

## ⚠️ Neden Yavaş?

**Rate Limiting:**
- TheSports API'de saniyede istek limiti var
- Çok fazla veri çekiliyor (binlerce takım, maç, vb.)
- Rate limit nedeniyle istekler yavaşlatılıyor
- **Normal bir durum** - güvenlik için

**Örnek:**
```
Rate limit exceeded for /team/additional/list, waiting 11316ms
```
Bu, "çok hızlı istek attın, 11 saniye bekle" demek.

---

## 🎯 Sonuç

**Evet, tüm maçları Supabase database'ine aktarıyoruz!**

1. **Bootstrap:** İlk açılışta master data + bugünün maçları
2. **Workers:** Periyodik olarak yeni maçları, canlı maçları sync eder
3. **WebSocket:** Canlı maç güncellemelerini anlık alır

---

## ⏱️ Ne Kadar Sürer?

- **Master Data Sync:** 10-30 dakika (rate limit nedeniyle)
- **Matches Sync:** Master data sonrası başlar, 5-15 dakika
- **Toplam:** 15-45 dakika (ilk açılışta)

---

## 📋 Kontrol Komutları

```bash
# Bootstrap durumu
pm2 logs goalgpt-backend --lines 500 --nostream | grep -i "bootstrap.*complete\|sync.*complete" | tail -n 10

# Matches kayıt sayısı
cd /var/www/goalgpt && node -e "const {Pool}=require('pg');require('dotenv').config();const p=new Pool({host:process.env.DB_HOST,port:parseInt(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,ssl:{rejectUnauthorized:false}});p.query('SELECT COUNT(*) as c FROM ts_matches').then(r=>{console.log('ts_matches:',r.rows[0].c);process.exit(0)}).catch(e=>{console.error(e.message);process.exit(1)});"

# Teams kayıt sayısı
cd /var/www/goalgpt && node -e "const {Pool}=require('pg');require('dotenv').config();const p=new Pool({host:process.env.DB_HOST,port:parseInt(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,ssl:{rejectUnauthorized:false}});p.query('SELECT COUNT(*) as c FROM ts_teams').then(r=>{console.log('ts_teams:',r.rows[0].c);process.exit(0)}).catch(e=>{console.error(e.message);process.exit(1)});"
```

---

## ✅ Özet

**Ne yapıyoruz?**
- TheSports API'den veri çekip Supabase database'ine kaydediyoruz
- Master data (takımlar, ligler, vb.) + Matches (maçlar) sync ediliyor
- Rate limit nedeniyle yavaş ilerliyor (normal)

**Ne zaman tamamlanır?**
- 15-45 dakika içinde bootstrap tamamlanır
- Sonrasında matches endpoint'leri data döndürecek




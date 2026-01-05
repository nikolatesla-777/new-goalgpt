# Maç Başlama Sorunu - Kökten Tespit Raporu

**Tarih:** 2026-01-05 09:05 TSİ  
**Kritik Sorun:** Görseldeki maçlar (01:30 ve 03:30 başlama saatli) hala "Başlamadı" durumunda.

## 🚨 KRİTİK BULGULAR

### 1. Database'de Maç Yok
- `/api/matches/diary?date=2026-01-05` → **0 maç**
- `/api/matches/diary?date=2026-01-04` → **0 maç**
- Bu, DailyMatchSyncWorker'ın çalışmadığı veya sync'in başarısız olduğu anlamına geliyor

### 2. DailyMatchSyncWorker Durumu
- **Kod:** `src/server.ts` içinde başlatılmış ✅
- **Cron Schedule:** Her gece 00:05 (TSİ) çalışması gerekiyor ✅
- **Loglar:** "CRON TRIGGERED" veya "Starting new day sync" logları YOK ❌

### 3. MatchWatchdogWorker Durumu
- **Interval:** Her 5 saniyede bir çalışıyor ✅
- **findShouldBeLiveMatches:** maxMinutesAgo=1440, limit=2000 ✅
- **Sonuç:** `/api/matches/should-be-live` → **BOŞ** (database'de maç olmadığı için)

### 4. Rate Limiting
- Loglardan: "Rate limit exceeded for /match/detail_live, waiting XXXXms" görülüyor
- Bu, API çağrılarının yavaşlatıldığı anlamına geliyor

## 🔍 SORUN ANALİZİ

### A. DailyMatchSyncWorker Çalışmıyor
**Olası Nedenler:**
1. Cron job tetiklenmemiş (timezone sorunu?)
2. Sync başarısız olmuş ama log yok
3. Worker başlatılmamış (PM2 restart sonrası?)

### B. Sync Başarısız
**Olası Nedenler:**
1. TheSports API'den veri gelmiyor
2. Rate limiting nedeniyle sync bloke oluyor
3. Database connection sorunu
4. Error handling eksik - hata loglanmıyor

### C. Timezone Sorunu
- Server UTC'de çalışıyor
- Cron job TSİ timezone kullanıyor (`Europe/Istanbul`)
- Timezone conversion hatası olabilir

## 💡 ÇÖZÜM ÖNERİLERİ

### 1. Acil: Manuel Sync Tetikle
```bash
# API endpoint ile manuel sync
curl -X POST https://partnergoalgpt.com/api/matches/admin/pre-sync
```

### 2. DailyMatchSyncWorker Log Kontrolü
```bash
pm2 logs goalgpt-backend | grep -E "DailyDiary|CRON TRIGGERED|syncTodayDiary"
```

### 3. Timezone Kontrolü
- Server timezone: UTC
- Cron timezone: Europe/Istanbul
- Timezone conversion doğru mu kontrol et

### 4. Rate Limiting Kontrolü
- TheSports API rate limit: 60 req/min
- Çok fazla API çağrısı yapılıyor olabilir
- Rate limiting ayarlarını kontrol et

### 5. Error Handling İyileştir
- DailyMatchSyncWorker'da error handling eksik olabilir
- Hatalar loglanmıyor olabilir
- Try-catch blokları kontrol et

## 🎯 ÖNCELİKLİ AKSİYONLAR

1. **HEMEN:** Manuel sync tetikle (bugünün maçları için)
2. **HEMEN:** DailyMatchSyncWorker loglarını kontrol et
3. **KISA VADELİ:** Timezone conversion'ı test et
4. **KISA VADELİ:** Rate limiting ayarlarını optimize et
5. **UZUN VADELİ:** Error handling ve logging iyileştir

## 📊 BEKLENEN DURUM

- **4 Ocak:** ~600+ maç olmalı
- **5 Ocak:** ~600+ maç olmalı
- **Şu An:** 0 maç ❌

Bu, sistemin kritik bir sorunu olduğunu gösteriyor.


# TheSports API Endpoint Test Script

## 🎯 Amaç

Bu script, tüm TheSports API endpoint'lerini test eder ve hangi endpoint'lerin erişilebilir olduğunu (access hatası olmayan) raporlar.

## 📋 Kullanım

### VPS'te Çalıştırma

```bash
# VPS'e SSH ile bağlan
ssh root@142.93.103.128

# Proje dizinine git
cd /var/www/goalgpt

# Script'i çalıştır
npm run test:all-endpoints
```

### Çıktı Formatı

Script, her endpoint için şu bilgileri gösterir:
- ✅ **SUCCESS**: Endpoint erişilebilir
- ❌ **ACCESS_DENIED**: IP whitelist hatası
- ⚠️  **ERROR**: Diğer hatalar
- ⏱️  **TIMEOUT**: İstek zaman aşımı

### Örnek Çıktı

```
🧪 Testing TheSports API Endpoints...

Base URL: https://api.thesports.com/v1/football
User: goalgpt
Secret: 3205e4f6...

───────────────────────────────────────────────────────────────────────────────────────

📋 Testing Basic Info Endpoints...

Testing category... ✅ 200 (has results)
Testing country... ✅ 200 (has results)
Testing competition... ✅ 200 (has results)
Testing team... ✅ 200 (has results)
...

───────────────────────────────────────────────────────────────────────────────────────

📊 Test Results Summary

┌──────────────────────────┬──────────────────────────────────────────────┬─────────────────────┬──────┬────────────────────────────────┐
│ Endpoint                 │ URL                                          │ Status              │ Code │ Notes                          │
├──────────────────────────┼──────────────────────────────────────────────┼─────────────────────┼──────┼────────────────────────────────┤
│ category                 │ /category/list                              │ ✅ SUCCESS          │ 200  │ Has results (10)               │
│ country                  │ /country/list                               │ ✅ SUCCESS          │ 200  │ Has results (250)              │
│ matchRecent              │ /match/recent/list                          │ ✅ SUCCESS          │ 200  │ Has results (50)               │
│ matchDetailLive          │ /match/detail_live                          │ ✅ SUCCESS          │ 200  │ Has results                    │
│ dataUpdate               │ /data/update                                │ ✅ SUCCESS          │ 200  │ Has results                    │
└──────────────────────────┴──────────────────────────────────────────────┴─────────────────────┴──────┴────────────────────────────────┘

📈 Statistics:
   ✅ Success: 28/31
   ❌ Access Denied: 0/31
   ⚠️  Error: 3/31
   ⏱️  Timeout: 0/31
```

## 🔧 Gereksinimler

- `.env` dosyasında `THESPORTS_API_USER` ve `THESPORTS_API_SECRET` tanımlı olmalı
- VPS'te Node.js ve npm kurulu olmalı
- Network bağlantısı olmalı (TheSports API'ye erişim)

## 📝 Notlar

- Script her endpoint arasında 200ms bekleme yapar (rate limiting'i önlemek için)
- Her endpoint için 10 saniye timeout süresi vardır
- Test süresi yaklaşık 1-2 dakika sürebilir (31 endpoint)

## 🚨 Sorun Giderme

### "THESPORTS_API_SECRET environment variable is not set!" Hatası

`.env` dosyasını kontrol edin:
```bash
cat /var/www/goalgpt/.env | grep THESPORTS
```

### Access Denied Hataları

IP whitelist'te olmayan endpoint'ler için TheSports API support'a başvurun.



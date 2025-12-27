# IP Whitelist Bilgisi - TheSports API

**Date:** 24 Aralık 2025

---

## 🔴 Tespit Edilen IP Adresi

### Production Sunucu IP
```
151.250.60.69
```

**Kanıt:**
```bash
# Outbound IP test
$ curl -s https://api.ipify.org
151.250.60.69

# HTTPBin IP test
$ curl -s http://httpbin.org/ip
{"origin": "151.250.60.69"}
```

---

## 📍 TheSports API'ye İstek Atılan Yer

### Base URL
```
https://api.thesports.com/v1/football
```

**Konfigürasyon:**
- Environment Variable: `THESPORTS_API_BASE_URL`
- Default: `https://api.thesports.com/v1/football`
- Config File: `src/config/index.ts`

### İstek Atılan Endpoint'ler

1. **`/match/recent/list`** ❌ IP whitelist hatası
2. **`/match/detail_live`** ❌ IP whitelist hatası
3. **`/data/update`** ❌ IP whitelist hatası
4. **`/match/diary`** ✅ Çalışıyor (bazı durumlarda)

---

## 🚨 Hata Mesajı

```
"IP is not authorized to access, please contact our business staff."
```

**Log Örnekleri:**
```json
{
  "level": "warn",
  "message": "TheSports API error for match recent: IP is not authorized to access, please contact our business staff.",
  "service": "goalgpt-dashboard",
  "timestamp": "2025-12-24 11:11:45"
}
```

---

## ✅ Çözüm: TheSports API Support'a Gönderilecek Mesaj

### Mesaj Şablonu

```
Subject: IP Whitelist Request - GoalGPT Account

Dear TheSports API Support,

We need to whitelist the following IP address for our GoalGPT account:

IP Address: 151.250.60.69

Account Details:
- User: goalgpt
- Account Type: [Your account tier]

Endpoints Required:
- /match/recent/list
- /match/detail_live
- /data/update

Currently, these endpoints are returning:
"IP is not authorized to access, please contact our business staff."

Please add this IP to the whitelist for our account.

Thank you,
GoalGPT Team
```

---

## 📊 Etkilenen Endpoint'ler

| Endpoint | Durum | Etki |
|----------|-------|------|
| `/match/recent/list` | ❌ IP whitelist hatası | Watchdog çalışmıyor |
| `/match/detail_live` | ❌ IP whitelist hatası | Reconcile çalışmıyor |
| `/data/update` | ❌ IP whitelist hatası | DataUpdate worker çalışmıyor |
| `/match/diary` | ✅ Çalışıyor | Bazı durumlarda çalışıyor |

---

## 🔍 IP Adresi Doğrulama

### Test Komutları

```bash
# 1. Outbound IP kontrolü
curl -s https://api.ipify.org

# 2. HTTPBin IP kontrolü
curl -s http://httpbin.org/ip

# 3. TheSports API'ye test isteği (IP kontrolü için)
curl -s "https://api.thesports.com/v1/football/match/recent/list?user=goalgpt&secret=YOUR_SECRET&page=1&limit=1"
```

---

## 📝 Notlar

1. **IP Adresi:** `151.250.60.69` - Bu IP production sunucunun outbound IP'si
2. **Whitelist Gereksinimi:** TheSports API bazı endpoint'ler için IP whitelist zorunlu
3. **Account Scope:** IP whitelist dışında account tier kontrolü de gerekebilir
4. **Geçici Çözüm:** Watchdog diary fallback eklendi (ama asıl sorun IP whitelist)

---

## 🎯 Sonraki Adımlar

1. ✅ IP adresi tespit edildi: `151.250.60.69`
2. ⏳ TheSports API support'a IP whitelist isteği gönderilmeli
3. ⏳ Account tier kontrolü yapılmalı
4. ⏳ Whitelist onayı sonrası endpoint'ler test edilmeli






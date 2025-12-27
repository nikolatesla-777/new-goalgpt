# 🎯 Deployment Sonrası Adımlar

**Date:** 24 Aralık 2025  
**VPS:** ubuntu-s-1vcpu-1gb-fra1-01 (129.212.195.44)

---

## ✅ DEPLOYMENT TAMAMLANDI

Deployment script başarıyla çalıştı:
- ✅ Node.js kurulu
- ✅ PM2 kurulu
- ✅ Proje clone edildi
- ✅ Dependencies kuruldu
- ✅ .env dosyası oluşturuldu
- ✅ PM2 service başlatıldı

---

## 🔍 TEST ADIMLARI

### 1. PM2 Status Kontrol
```bash
pm2 status
```

**Beklenen çıktı:**
- `goalgpt-backend` → `online` (yeşil)
- Uptime > 0s
- Memory kullanımı görünür

### 2. PM2 Logs Kontrol
```bash
pm2 logs goalgpt-backend --lines 50
```

**Kontrol edilecekler:**
- ✅ Server başladı mı? (`Server listening on port 3000`)
- ❌ Database connection hatası var mı? (Normal - placeholder DB)
- ❌ TheSports API hatası var mı?

### 3. API Test
```bash
curl http://localhost:3000/api/matches/recent
```

**Beklenen:**
- JSON response
- Veya error mesajı (database connection - normal)

### 4. Outbound IP Kontrol
```bash
curl https://api.thesports.com/v1/ip/demo
```

**Çıktı:**
```json
{
  "code": 0,
  "results": {
    "host": "api.thesports.com",
    "request_ip": "129.212.195.44"  // VPS IP'si
  }
}
```

**⚠️ ÖNEMLİ:** Bu IP'yi TheSports API whitelist'e ekle!

---

## 🔧 SORUN GİDERME

### PM2 Process Çalışmıyor
```bash
# Logs kontrol
pm2 logs goalgpt-backend

# Restart
pm2 restart goalgpt-backend

# Eğer hala çalışmıyorsa, manuel başlat
cd /var/www/goalgpt
npm start
```

### Database Connection Hatası
**Normal!** Placeholder DB kullanıyoruz. Supabase setup'tan sonra düzelecek.

### Port 3000 Kullanımda
```bash
# Port kontrol
sudo lsof -i :3000

# Process kill
sudo kill -9 [PID]
```

---

## 📋 SONRAKI ADIMLAR

### Şimdi Yapılacaklar:
1. ✅ Test komutlarını çalıştır
2. ✅ Outbound IP'yi al
3. ✅ TheSports API IP whitelist'e ekle
4. ⏭️ Supabase setup (sonraki adım)

### Supabase Setup (Sonraki Adım):
1. Supabase projesi oluştur
2. Database schema import et
3. Connection string al
4. .env dosyasını güncelle
5. PM2 restart

---

## 🎯 HIZLI KOMUTLAR

```bash
# PM2 Status
pm2 status

# PM2 Logs
pm2 logs goalgpt-backend --lines 50

# PM2 Restart
pm2 restart goalgpt-backend

# API Test
curl http://localhost:3000/api/matches/recent

# Outbound IP
curl https://api.thesports.com/v1/ip/demo

# .env Düzenle
nano /var/www/goalgpt/.env
```

---

## 📝 CHECKLIST

- [ ] PM2 status kontrol edildi
- [ ] PM2 logs kontrol edildi
- [ ] API test yapıldı
- [ ] Outbound IP alındı
- [ ] TheSports API IP whitelist'e eklendi
- [ ] Supabase setup hazırlığı yapıldı






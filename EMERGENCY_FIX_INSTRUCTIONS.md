# 🚨 ACİL FİX: Backend Başlatma

## VPS'e SSH ile Bağlan

```bash
ssh root@142.93.103.128
```

## Backend'i Başlat

```bash
cd /var/www/goalgpt

# En son kodu çek
git pull origin main

# Dependencies kur
npm install --production

# Logs klasörü oluştur
mkdir -p logs

# Eski process'i durdur
pm2 stop goalgpt-backend 2>/dev/null || pm2 delete goalgpt-backend 2>/dev/null

# Backend'i başlat
if [ -f ecosystem.config.js ]; then
  pm2 start ecosystem.config.js
else
  pm2 start npm --name "goalgpt-backend" -- start
fi

# PM2 process list'i kaydet (server restart'ta otomatik başlasın)
pm2 save

# Durumu kontrol et
pm2 status

# 5 saniye bekle ve health check yap
sleep 5
curl http://localhost:3000/ready

# Logları kontrol et
pm2 logs goalgpt-backend --lines 30 --nostream
```

## Beklenen Sonuç

✅ `pm2 status` → goalgpt-backend "online" görünmeli
✅ `curl http://localhost:3000/ready` → `{"ok":true,...}` dönmeli
✅ Loglarda "Server listening on port 3000" mesajı görünmeli

## Hala Çalışmıyorsa

Logları kontrol et:
```bash
pm2 logs goalgpt-backend --lines 100
```

Olası hatalar:
- Database connection hatası → `.env` dosyasını kontrol et
- Port 3000 kullanımda → `sudo lsof -i :3000` ile kontrol et
- Dependencies eksik → `npm install --production` tekrar çalıştır

# 🚀 VPS Deployment Guide (Mevcut Droplet)

**Date:** 24 Aralık 2025  
**Droplet:** ubuntu-s-1vcpu-1gb-fra1-01  
**IP:** 129.212.195.44  
**Repository:** https://github.com/nikolatesla-777/new-goalgpt

---

## 📋 ÖN HAZIRLIK

### 1. SSH Bağlantısı
```bash
# DigitalOcean'dan SSH key kullanarak bağlan
ssh root@129.212.195.44
# veya
ssh [USERNAME]@129.212.195.44
```

### 2. Sistem Güncellemesi
```bash
sudo apt update
sudo apt upgrade -y
```

---

## 🔧 KURULUM ADIMLARI

### 1. Node.js Kurulumu

#### 1.1 Node.js 20.x Kur (LTS)
```bash
# NodeSource repository ekle
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Node.js kur
sudo apt install -y nodejs

# Versiyon kontrol
node --version  # v20.x.x olmalı
npm --version
```

#### 1.2 PM2 Kur (Process Manager)
```bash
sudo npm install -g pm2
```

---

### 2. Proje Kurulumu

#### 2.1 Proje Dizini Oluştur
```bash
# Proje dizini
sudo mkdir -p /var/www/goalgpt
sudo chown $USER:$USER /var/www/goalgpt
cd /var/www/goalgpt
```

#### 2.2 GitHub'dan Clone
```bash
# GitHub repository'yi clone et
git clone https://github.com/nikolatesla-777/new-goalgpt.git .

# veya direkt clone
git clone https://github.com/nikolatesla-777/new-goalgpt.git /var/www/goalgpt
cd /var/www/goalgpt
```

#### 2.3 Dependencies Kur
```bash
npm install
```

---

### 3. Environment Variables

#### 3.1 .env Dosyası Oluştur
```bash
cd /var/www/goalgpt
nano .env
```

#### 3.2 .env İçeriği (Placeholder DB - Supabase'den sonra güncellenecek)
```env
# Database (Supabase - Placeholder)
DB_HOST=placeholder
DB_PORT=6543
DB_NAME=postgres
DB_USER=placeholder
DB_PASSWORD=placeholder
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

**Kaydet:** `Ctrl+O`, `Enter`, `Ctrl+X`

---

### 4. PM2 Service Olarak Çalıştır

#### 4.1 PM2 Start
```bash
cd /var/www/goalgpt
pm2 start npm --name "goalgpt-backend" -- start
```

#### 4.2 PM2 Startup Script (Server restart'ta otomatik başlat)
```bash
# Startup script oluştur
pm2 startup

# Çıkan komutu çalıştır (sudo ile)
# Örnek: sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp /home/$USER

# PM2'yi kaydet
pm2 save
```

#### 4.3 PM2 Komutları
```bash
# Status kontrol
pm2 status

# Logs
pm2 logs goalgpt-backend

# Restart
pm2 restart goalgpt-backend

# Stop
pm2 stop goalgpt-backend
```

---

### 5. Nginx Reverse Proxy (Opsiyonel - Önerilen)

#### 5.1 Nginx Kur
```bash
sudo apt install -y nginx
```

#### 5.2 Nginx Config
```bash
sudo nano /etc/nginx/sites-available/goalgpt
```

**Config içeriği:**
```nginx
server {
    listen 80;
    server_name 129.212.195.44;  # veya domain name

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Kaydet ve aktif et:**
```bash
# Symlink oluştur
sudo ln -s /etc/nginx/sites-available/goalgpt /etc/nginx/sites-enabled/

# Config test
sudo nginx -t

# Nginx restart
sudo systemctl restart nginx
```

#### 5.3 Firewall Ayarları
```bash
# UFW firewall (eğer aktifse)
sudo ufw allow 'Nginx Full'
sudo ufw allow 3000/tcp  # Direkt erişim için (opsiyonel)
```

---

### 6. Test

#### 6.1 Local Test
```bash
# PM2 status
pm2 status

# Logs kontrol
pm2 logs goalgpt-backend --lines 50

# API test
curl http://localhost:3000/api/matches/recent
```

#### 6.2 External Test
```bash
# IP üzerinden test
curl http://129.212.195.44/api/matches/recent

# veya Nginx üzerinden
curl http://129.212.195.44/api/matches/recent
```

---

## 🔍 TROUBLESHOOTING

### PM2 Process Çalışmıyor
```bash
# Logs kontrol
pm2 logs goalgpt-backend

# Error varsa, .env dosyasını kontrol et
cat /var/www/goalgpt/.env

# Database connection hatası normal (placeholder DB)
```

### Port 3000 Kullanımda
```bash
# Port kontrol
sudo lsof -i :3000

# Process'i kill et
sudo kill -9 [PID]
```

### Nginx 502 Bad Gateway
```bash
# PM2 process çalışıyor mu?
pm2 status

# Nginx config test
sudo nginx -t

# Nginx logs
sudo tail -f /var/log/nginx/error.log
```

---

## 🔄 GÜNCELLEME (GitHub Push Sonrası)

### Otomatik Update Script
```bash
#!/bin/bash
# /var/www/goalgpt/update.sh

cd /var/www/goalgpt
git pull origin main
npm install
pm2 restart goalgpt-backend
```

**Kullanım:**
```bash
chmod +x /var/www/goalgpt/update.sh
./update.sh
```

---

## 📝 CHECKLIST

### VPS Setup
- [ ] SSH bağlantısı yapıldı
- [ ] Node.js 20.x kuruldu
- [ ] PM2 kuruldu
- [ ] Proje clone edildi
- [ ] npm install yapıldı
- [ ] .env dosyası oluşturuldu
- [ ] PM2 service başlatıldı
- [ ] PM2 startup script eklendi
- [ ] Nginx kuruldu (opsiyonel)
- [ ] Nginx config yapıldı (opsiyonel)
- [ ] Test edildi

### Sonraki Adımlar
- [ ] Supabase projesi oluştur
- [ ] Database migration yap
- [ ] .env dosyasını güncelle (Supabase credentials)
- [ ] PM2 restart
- [ ] Outbound IP kontrol et
- [ ] TheSports API IP whitelist'e ekle

---

## 🎯 SONRAKI ADIM: SUPABASE

VPS deployment tamamlandıktan sonra:
1. Supabase projesi oluştur
2. Database schema import et
3. Connection string'i al
4. .env dosyasını güncelle
5. PM2 restart
6. Final test

---

## 💰 MALİYET

**Mevcut VPS kullanılıyor:** $0 ekstra maliyet! ✅

---

## 📚 KAYNAKLAR

- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Nginx Reverse Proxy](https://www.nginx.com/resources/wiki/start/topics/examples/full/)
- [DigitalOcean Droplet Management](https://docs.digitalocean.com/products/droplets/)





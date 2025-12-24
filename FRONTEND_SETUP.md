# 🖥️ Frontend Setup - Canlı Maçları Tarayıcıda Görme

## 🎯 Amaç
Database'deki maçların canlı olarak güncellendiğini (dakika ilerlemesi, devre arası, ikinci yarı, maç bitişi) tarayıcı üzerinde görmek.

---

## 📋 Adım 1: Frontend'i Local'de Çalıştır

### 1.1 Frontend Klasörüne Git
```bash
cd /Users/utkubozbay/Desktop/project/frontend
```

### 1.2 Dependencies Kur
```bash
npm install
```

### 1.3 Backend URL'i Ayarla

**Seçenek A: Environment Variable (Önerilen)**
```bash
# .env dosyası oluştur
echo "VITE_API_URL=http://142.93.103.128:3000/api" > .env
```

**Seçenek B: Vite Config Proxy (Local için)**
`vite.config.ts` dosyasında proxy zaten var, ama DigitalOcean backend için güncelle:
```typescript
proxy: {
  '/api': {
    target: 'http://142.93.103.128:3000',
    changeOrigin: true,
  },
}
```

### 1.4 Frontend'i Başlat
```bash
npm run dev
```

Frontend `http://localhost:5173` adresinde çalışacak.

---

## 📋 Adım 2: Tarayıcıda Aç

1. Tarayıcıda `http://localhost:5173` adresini aç
2. **"Canlı Maçlar"** sekmesine tıkla
3. Canlı maçları göreceksin:
   - ✅ CANLI badge
   - ✅ Dakika (örn: "45+", "HT", "67")
   - ✅ Skor güncellemeleri
   - ✅ Devre arası durumu
   - ✅ İkinci yarı başlangıcı
   - ✅ Maç bitişi

---

## 🔄 Real-Time Updates

Frontend otomatik olarak:
- **Her 60 saniyede** maç listesini yeniler (`MatchList.tsx` line 208)
- Backend'den gelen `minute_text` ve `status_id` değerlerini gösterir
- Dakika ilerlemesini backend'den alır (frontend hesaplamaz)

---

## 🎨 Görüntülenen Bilgiler

### MatchCard Component Gösterir:
- **CANLI** badge (kırmızı, yanıp söner)
- **DEVRE ARASI** badge (turuncu, status=3)
- **Dakika** badge (turuncu, örn: "45+", "HT", "67", "90+")
- **Skor** (home_score vs away_score)
- **Takım isimleri**
- **Lig bilgisi**

---

## 🚀 Production Deploy (Opsiyonel)

Frontend'i DigitalOcean'a deploy etmek için:

### 1. Build
```bash
cd frontend
npm run build
```

### 2. Nginx Setup
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    root /var/www/goalgpt-frontend/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## ✅ Test Checklist

- [ ] Frontend çalışıyor (`http://localhost:5173`)
- [ ] Backend'e bağlanıyor (`http://142.93.103.128:3000`)
- [ ] Canlı Maçlar sekmesi açılıyor
- [ ] Maçlar görünüyor
- [ ] CANLI badge görünüyor
- [ ] Dakika güncelleniyor (60 saniyede bir)
- [ ] Skor güncelleniyor
- [ ] Devre arası durumu gösteriliyor

---

## 🐛 Sorun Giderme

### Frontend Backend'e Bağlanamıyor
- Backend'in çalıştığını kontrol et: `curl http://142.93.103.128:3000/health`
- CORS hatası varsa, backend'de CORS ayarlarını kontrol et

### Maçlar Görünmüyor
- Browser console'u aç (F12)
- Network tab'inde API isteklerini kontrol et
- Backend loglarını kontrol et: `pm2 logs goalgpt-backend`

### Dakika Güncellenmiyor
- Backend'de `minute_text` field'ının dolu olduğunu kontrol et
- MatchMinuteUpdateWorker'ın çalıştığını kontrol et
- Browser console'da hata var mı kontrol et



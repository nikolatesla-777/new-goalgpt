# 🚀 DigitalOcean + Supabase Migration Plan

**Date:** 24 Aralık 2025  
**Goal:** Projeyi DigitalOcean'a taşı ve Supabase PostgreSQL kullan

---

## 📋 ÖN HAZIRLIK

### 1. GitHub Repository
- [ ] GitHub hesabı oluştur (veya mevcut hesabı kullan)
- [ ] Yeni private repository oluştur: `goalgpt-backend`
- [ ] Mevcut kodu GitHub'a push et
- [ ] `.env` dosyasını `.gitignore`'a ekle (güvenlik)
- [ ] `.env.example` dosyası oluştur (template)

### 2. Supabase Projesi Oluşturma
- [ ] Supabase hesabı oluştur (https://supabase.com)
- [ ] Yeni proje oluştur
- [ ] Database connection string'i al
- [ ] Connection pooling ayarlarını yapılandır

### 3. DigitalOcean Hesabı
- [ ] DigitalOcean hesabı oluştur
- [ ] GitHub hesabını DigitalOcean'a bağla (App Platform için)
- [ ] Droplet veya App Platform seçimi
- [ ] Static IP adresi al (TheSports API whitelist için)

---

## 🔄 MIGRATION ADIMLARI

### PHASE 1: Database Migration (Supabase)

#### 1.1 Mevcut Database Schema Export
```bash
# Mevcut database'den schema export
pg_dump -h 147.93.122.175 -U goalgpt -d DbGoalGPT --schema-only > schema.sql
```

#### 1.2 Supabase'e Schema Import
```bash
# Supabase connection string ile import
psql "postgresql://[SUPABASE_CONNECTION_STRING]" < schema.sql
```

#### 1.3 Data Migration (Opsiyonel - Production data varsa)
```bash
# Sadece data export (schema olmadan)
pg_dump -h 147.93.122.175 -U goalgpt -d DbGoalGPT --data-only > data.sql

# Supabase'e data import
psql "postgresql://[SUPABASE_CONNECTION_STRING]" < data.sql
```

#### 1.4 Connection String Format
Supabase connection string formatı:
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
```

**Direct connection (migrations için):**
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
```

---

### PHASE 2: Environment Variables Güncelleme

#### 2.1 Yeni .env Dosyası Oluştur
```env
# Database (Supabase)
DB_HOST=aws-0-[REGION].pooler.supabase.com
DB_PORT=6543
DB_NAME=postgres
DB_USER=postgres.[PROJECT_REF]
DB_PASSWORD=[SUPABASE_PASSWORD]
DB_MAX_CONNECTIONS=20

# Supabase Connection Pooling (pgbouncer)
# Port 6543 = Transaction mode (migrations için)
# Port 5432 = Direct connection (migrations için)

# TheSports API (değişmedi)
THESPORTS_API_BASE_URL=https://api.thesports.com/v1/football
THESPORTS_API_SECRET=[SECRET]
THESPORTS_API_USER=goalgpt

# Logging
LOG_LEVEL=info

# Server
PORT=3000
NODE_ENV=production
```

#### 2.2 Connection String Validation
```typescript
// src/database/connection.ts güncellemesi
// Supabase connection pooling için optimize et
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '6543'), // pgbouncer port
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
  ssl: {
    rejectUnauthorized: false // Supabase SSL
  },
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

---

### PHASE 3: DigitalOcean Deployment

#### 3.1 Seçenek A: DigitalOcean Droplet (VPS)
**Avantajlar:**
- Full control
- Static IP garantisi
- Custom configuration

**Adımlar:**
1. Droplet oluştur (Ubuntu 22.04 LTS)
2. Static IP al
3. Node.js 20.x kurulumu
4. PM2 veya systemd service
5. Nginx reverse proxy (opsiyonel)

#### 3.2 Seçenek B: DigitalOcean App Platform (ÖNERİLEN)
**Avantajlar:**
- Auto-scaling
- Auto-deployment (GitHub integration) ✅
- Managed SSL
- Daha az yönetim
- GitHub push = otomatik deploy

**Adımlar:**
1. App Platform'da yeni app oluştur
2. **GitHub repo bağla** (repository seç)
3. Branch seç: `main` veya `master`
4. Build command: `npm install`
5. Run command: `npm start`
6. Environment variables ekle (UI'dan)
7. **Auto-deploy aktif** (her push'ta deploy)

---

### PHASE 4: TheSports API IP Whitelist

#### 4.1 DigitalOcean Static IP Al
```bash
# Droplet kullanıyorsanız, zaten static IP var
# App Platform kullanıyorsanız, outbound IP'yi kontrol et
curl https://api.thesports.com/v1/ip/demo
```

#### 4.2 TheSports Dashboard'a IP Ekle
- DigitalOcean'dan aldığınız static IP'yi TheSports whitelist'e ekle
- Tüm endpoint'lerin çalıştığını test et

---

### PHASE 5: GitHub Setup & CI/CD

#### 5.1 GitHub Repository Hazırlığı
```bash
# Mevcut projeyi GitHub'a push et
cd /Users/utkubozbay/Desktop/project
git init
git add .
git commit -m "Initial commit - GoalGPT Backend"
git remote add origin https://github.com/[USERNAME]/goalgpt-backend.git
git push -u origin main
```

#### 5.2 .gitignore Kontrolü
```gitignore
# .gitignore dosyasına ekle
.env
.env.local
.env.production
node_modules/
logs/
*.log
dist/
.DS_Store
```

#### 5.3 .env.example Oluştur
```env
# .env.example (template)
DB_HOST=aws-0-[REGION].pooler.supabase.com
DB_PORT=6543
DB_NAME=postgres
DB_USER=postgres.[PROJECT_REF]
DB_PASSWORD=your_password_here
DB_MAX_CONNECTIONS=20

THESPORTS_API_BASE_URL=https://api.thesports.com/v1/football
THESPORTS_API_SECRET=your_secret_here
THESPORTS_API_USER=goalgpt

LOG_LEVEL=info
PORT=3000
NODE_ENV=production
```

#### 5.4 GitHub Actions (Opsiyonel - CI/CD)
```yaml
# .github/workflows/deploy.yml
name: Deploy to DigitalOcean
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to DigitalOcean
        # DigitalOcean App Platform otomatik deploy yapıyor
        # Bu sadece test/validation için
```

---

### PHASE 6: Code Updates

#### 5.1 Database Connection (Supabase SSL)
```typescript
// src/database/connection.ts
const pool = new Pool({
  // ... existing config
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false // Supabase SSL
  } : false,
});
```

#### 5.2 Migration Scripts
```bash
# Migration için direct connection kullan (port 5432)
# Normal operations için pooler connection kullan (port 6543)
```

---

### PHASE 7: Testing & Validation

#### 6.1 Database Connection Test
```bash
npm run test-connection
```

#### 6.2 TheSports API Test
```bash
# IP kontrolü
curl https://api.thesports.com/v1/ip/demo

# Endpoint test
curl http://localhost:3000/api/matches/recent
```

#### 6.3 Workers Test
- Watchdog worker çalışıyor mu?
- ProactiveCheck worker çalışıyor mu?
- MatchSync worker çalışıyor mu?

---

## 📝 CHECKLIST

### GitHub Setup
- [ ] GitHub repository oluşturuldu
- [ ] Kod push edildi
- [ ] .gitignore kontrol edildi
- [ ] .env.example oluşturuldu
- [ ] DigitalOcean'a GitHub bağlandı

### Supabase Setup
- [ ] Supabase projesi oluşturuldu
- [ ] Database connection string alındı
- [ ] Schema import edildi
- [ ] Data migration yapıldı (opsiyonel)
- [ ] Connection pooling test edildi

### DigitalOcean Setup
- [ ] DigitalOcean hesabı oluşturuldu
- [ ] Droplet/App Platform oluşturuldu
- [ ] Static IP alındı
- [ ] Node.js kuruldu
- [ ] PM2/systemd service kuruldu

### Code Updates
- [ ] .env dosyası güncellendi
- [ ] Database connection SSL eklendi
- [ ] Migration scripts test edildi

### TheSports API
- [ ] DigitalOcean IP TheSports whitelist'e eklendi
- [ ] Tüm endpoint'ler test edildi
- [ ] IP hatası yok

### Deployment
- [ ] GitHub repository DigitalOcean'a bağlandı
- [ ] Auto-deploy aktif
- [ ] Code deploy edildi (ilk push)
- [ ] Environment variables set edildi
- [ ] Server çalışıyor
- [ ] Workers çalışıyor
- [ ] Frontend bağlantısı çalışıyor
- [ ] GitHub push test edildi (otomatik deploy çalışıyor mu?)

---

## 🚨 ÖNEMLİ NOTLAR

1. **Supabase Connection Pooling:**
   - Port **6543** = Transaction mode (normal operations)
   - Port **5432** = Direct connection (migrations)
   - Her zaman **pgbouncer** kullan (port 6543)

2. **SSL Connection:**
   - Supabase SSL zorunlu
   - `rejectUnauthorized: false` kullan (Supabase self-signed cert)

3. **IP Whitelist:**
   - DigitalOcean static IP'yi TheSports'a ekle
   - IP değişmeyecek (static)

4. **Environment Variables:**
   - Production'da `.env` dosyası kullanma
   - DigitalOcean App Platform: Environment variables UI'dan
   - Droplet: Systemd service içinde set et

---

## 📚 KAYNAKLAR

- [Supabase Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [DigitalOcean Droplet Setup](https://docs.digitalocean.com/products/droplets/)
- [DigitalOcean App Platform](https://docs.digitalocean.com/products/app-platform/)

---

## 🎯 SONRAKI ADIMLAR

1. **Şimdi yapılacaklar:**
   - GitHub repository oluştur ve kod push et
   - Supabase projesi oluştur
   - DigitalOcean hesabı oluştur
   - Migration planını onayla

2. **Migration sırası:**
   - Database migration (Supabase)
   - Code updates
   - DigitalOcean deployment
   - IP whitelist
   - Testing

3. **Post-migration:**
   - Monitoring setup
   - Backup strategy
   - Performance optimization


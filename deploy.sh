#!/bin/bash

# GoalGPT Backend - VPS Deployment Script
# Kullanım: VPS'e SSH ile bağlandıktan sonra bu script'i çalıştır

set -e  # Hata durumunda dur

echo "🚀 GoalGPT Backend - VPS Deployment Başlıyor..."
echo ""

# Renkler
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. Node.js Kontrolü ve Kurulumu
echo -e "${YELLOW}1. Node.js kontrol ediliyor...${NC}"
if ! command -v node &> /dev/null; then
    echo "Node.js bulunamadı, kuruluyor..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
    echo -e "${GREEN}✅ Node.js kuruldu${NC}"
else
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✅ Node.js zaten kurulu: $NODE_VERSION${NC}"
fi

# 2. PM2 Kontrolü ve Kurulumu
echo -e "${YELLOW}2. PM2 kontrol ediliyor...${NC}"
if ! command -v pm2 &> /dev/null; then
    echo "PM2 bulunamadı, kuruluyor..."
    sudo npm install -g pm2
    echo -e "${GREEN}✅ PM2 kuruldu${NC}"
else
    echo -e "${GREEN}✅ PM2 zaten kurulu${NC}"
fi

# 3. Proje Dizini
PROJECT_DIR="/var/www/goalgpt"
echo -e "${YELLOW}3. Proje dizini hazırlanıyor: $PROJECT_DIR${NC}"

if [ -d "$PROJECT_DIR" ]; then
    echo "Proje dizini zaten var, güncelleniyor..."
    cd $PROJECT_DIR
    git pull origin main || echo "Git pull başarısız, devam ediliyor..."
else
    echo "Proje dizini oluşturuluyor..."
    sudo mkdir -p $PROJECT_DIR
    sudo chown $USER:$USER $PROJECT_DIR
    cd $PROJECT_DIR
    git clone https://github.com/nikolatesla-777/new-goalgpt.git .
fi

# 4. Dependencies
echo -e "${YELLOW}4. Dependencies kuruluyor...${NC}"
npm install
echo -e "${GREEN}✅ Dependencies kuruldu${NC}"

# 5. .env Dosyası Kontrolü
echo -e "${YELLOW}5. .env dosyası kontrol ediliyor...${NC}"
if [ ! -f "$PROJECT_DIR/.env" ]; then
    echo ".env dosyası bulunamadı, oluşturuluyor..."
    cat > $PROJECT_DIR/.env << 'EOF'
# Database (Supabase - Placeholder, sonra güncellenecek)
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
EOF
    echo -e "${GREEN}✅ .env dosyası oluşturuldu (placeholder değerlerle)${NC}"
    echo -e "${YELLOW}⚠️  .env dosyasını düzenlemeyi unutmayın!${NC}"
else
    echo -e "${GREEN}✅ .env dosyası zaten var${NC}"
fi

# 6. PM2 Service
echo -e "${YELLOW}6. PM2 service başlatılıyor...${NC}"
cd $PROJECT_DIR

# Eğer zaten çalışıyorsa durdur
pm2 delete goalgpt-backend 2>/dev/null || true

# Yeni service başlat
pm2 start npm --name "goalgpt-backend" -- start
pm2 save

echo -e "${GREEN}✅ PM2 service başlatıldı${NC}"

# 7. PM2 Startup Script
echo -e "${YELLOW}7. PM2 startup script ekleniyor...${NC}"
STARTUP_CMD=$(pm2 startup | grep "sudo" || echo "")
if [ ! -z "$STARTUP_CMD" ]; then
    echo "Startup komutu: $STARTUP_CMD"
    echo -e "${YELLOW}⚠️  Yukarıdaki komutu çalıştırmanız gerekebilir${NC}"
else
    echo -e "${GREEN}✅ PM2 startup zaten yapılandırılmış${NC}"
fi

# 8. Status
echo ""
echo -e "${GREEN}=== DEPLOYMENT TAMAMLANDI ===${NC}"
echo ""
echo "PM2 Status:"
pm2 status
echo ""
echo "PM2 Logs (son 20 satır):"
pm2 logs goalgpt-backend --lines 20 --nostream
echo ""
echo -e "${YELLOW}Sonraki adımlar:${NC}"
echo "1. .env dosyasını düzenle: nano $PROJECT_DIR/.env"
echo "2. Supabase credentials ekle (Supabase setup'tan sonra)"
echo "3. PM2 restart: pm2 restart goalgpt-backend"
echo "4. Test: curl http://localhost:3000/api/matches/recent"
echo "5. Outbound IP kontrol: curl https://api.thesports.com/v1/ip/demo"
echo "6. TheSports API IP whitelist'e ekle"



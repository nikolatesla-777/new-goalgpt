#!/bin/bash

echo "🚀 GoalGPT Dashboard - Docker Setup"
echo "=================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker bulunamadı!"
    echo ""
    echo "Lütfen önce Docker Desktop'ı kurun:"
    echo "1. https://www.docker.com/products/docker-desktop/ adresinden indirin"
    echo "2. Docker Desktop'ı kurun ve başlatın"
    echo "3. Bu scripti tekrar çalıştırın"
    echo ""
    exit 1
fi

echo "✅ Docker bulundu: $(docker --version)"
echo ""

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker çalışmıyor!"
    echo ""
    echo "Lütfen Docker Desktop'ı başlatın ve tekrar deneyin."
    echo ""
    exit 1
fi

echo "✅ Docker çalışıyor"
echo ""

# Start PostgreSQL container
echo "📦 PostgreSQL container'ını başlatıyorum..."
docker-compose up -d

# Wait for PostgreSQL to be ready
echo "⏳ PostgreSQL'in hazır olmasını bekliyorum..."
sleep 5

# Check if container is running
if docker-compose ps | grep -q "Up"; then
    echo "✅ PostgreSQL container çalışıyor!"
    echo ""
    echo "Veritabanı bilgileri:"
    echo "  Host: localhost"
    echo "  Port: 5432"
    echo "  Database: goalgpt"
    echo "  User: postgres"
    echo "  Password: postgres"
    echo ""
    echo "Sonraki adımlar:"
    echo "  1. npm run migrate      - Veritabanı şemasını oluştur"
    echo "  2. npm run import-csv   - CSV dosyalarını import et"
    echo "  3. npm run create-admin - Admin kullanıcısı oluştur"
    echo "  4. npm run dev          - Sunucuyu başlat"
    echo ""
else
    echo "❌ Container başlatılamadı!"
    echo ""
    echo "Logları kontrol edin:"
    echo "  docker-compose logs postgres"
    echo ""
    exit 1
fi


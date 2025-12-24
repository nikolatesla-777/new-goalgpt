#!/bin/bash

echo "=== GoalGPT - Network IP Bilgileri ==="
echo ""
echo "📍 Local IP Adresleri (Development için):"
ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print "  ✅ " $2}'
echo ""
echo "🌐 Public IP Adresi (Production için):"
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null)
if [ -n "$PUBLIC_IP" ]; then
  echo "  ✅ $PUBLIC_IP"
else
  echo "  ❌ Bulunamadı (internet bağlantınızı kontrol edin)"
fi
echo ""
echo "=== TheSports API IP Whitelist ==="
echo ""
echo "Bu IP adreslerini TheSports API business staff'a gönderin:"
echo ""
echo "📧 Email Template:"
echo "---"
echo "Subject: IP Whitelist Request - GoalGPT"
echo ""
echo "Merhaba,"
echo ""
echo "GoalGPT projesi için IP whitelist eklemesi yapılmasını rica ediyorum."
echo ""
echo "API Credentials:"
echo "- User: goalgpt"
echo "- Secret: 3205e4f6efe04a03f0055152c4aa0f37"
echo ""
echo "Eklenecek IP Adresleri:"
echo ""
ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print "- Development IP: " $2}' | head -1
if [ -n "$PUBLIC_IP" ]; then
  echo "- Production IP: $PUBLIC_IP"
fi
echo ""
echo "Teşekkürler."
echo "---"
echo ""
echo "✅ IP bilgileri hazır! TheSports API support ile iletişime geçin."


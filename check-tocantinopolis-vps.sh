#!/bin/bash
cd /var/www/goalgpt
echo "=== Checking Tocantinopolis Match Status ==="
node check-tocantinopolis-match.js

echo ""
echo "=== Recent ProactiveCheck Logs ==="
pm2 logs goalgpt-backend --lines 100 | grep -i "ProactiveCheck\|tocantinopolis\|gurupi" | tail -30

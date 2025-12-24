#!/bin/bash
# VPS'te çalıştır: bash VPS_CHECK_CAMEROON_PROVIDER.sh

cd /var/www/goalgpt || exit 1

echo "🔍 Checking provider status for Cameroon match..."
echo ""

node check-provider-cameroon-status.js

echo ""
echo "✅ Provider check complete."

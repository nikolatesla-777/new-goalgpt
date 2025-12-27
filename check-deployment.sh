#!/bin/bash
# GitHub Actions Deployment Status Checker

echo "🔍 GitHub Actions Deployment Durumu Kontrol Ediliyor..."
echo ""

MAX_CHECKS=60  # 10 dakika (10 saniye * 60)
CHECK_COUNT=0

while [ $CHECK_COUNT -lt $MAX_CHECKS ]; do
  CHECK_COUNT=$((CHECK_COUNT + 1))
  
  RESULT=$(curl -s "https://api.github.com/repos/nikolatesla-777/new-goalgpt/actions/runs?per_page=1" | python3 -c "
import sys, json
data = json.load(sys.stdin)
runs = data.get('workflow_runs', [])
r = runs[0] if runs else None
if r:
    status = r.get('status', 'unknown')
    conclusion = r.get('conclusion', 'N/A')
    name = r.get('name', 'N/A')
    url = r.get('html_url', 'N/A')
    commit = r.get('head_sha', '')[:7]
    print(f'{status}|{conclusion}|{name}|{url}|{commit}')
else:
    print('error|N/A|N/A|N/A|N/A')
" 2>/dev/null)
  
  IFS='|' read -r status conclusion name url commit <<< "$RESULT"
  
  if [ "$status" == "completed" ]; then
    echo ""
    echo "=" | tr -d '\n' && printf '=%.0s' {1..60} && echo ""
    echo "✅ DEPLOYMENT TAMAMLANDI!"
    echo "=" | tr -d '\n' && printf '=%.0s' {1..60} && echo ""
    echo "Workflow: $name"
    echo "Status: $status"
    echo "Conclusion: $conclusion"
    echo "Commit: $commit"
    echo "URL: $url"
    echo ""
    
    if [ "$conclusion" == "success" ]; then
      echo "✅ ✅ ✅ DEPLOYMENT BAŞARILI! ✅ ✅ ✅"
      echo ""
      echo "Deploy edilen commit: $commit"
      echo "Detaylı loglar: $url"
      echo ""
      exit 0
    else
      echo "❌ ❌ ❌ DEPLOYMENT BAŞARISIZ! ❌ ❌ ❌"
      echo ""
      echo "Conclusion: $conclusion"
      echo "Detaylı loglar: $url"
      echo ""
      exit 1
    fi
  elif [ "$status" == "in_progress" ] || [ "$status" == "queued" ]; then
    echo "[$CHECK_COUNT/$MAX_CHECKS] ⏳ Deployment çalışıyor... (Status: $status)"
    sleep 10
  else
    echo "[$CHECK_COUNT/$MAX_CHECKS] ⚠️ Beklenmeyen durum: $status"
    sleep 10
  fi
done

echo ""
echo "⏱️ Timeout: $MAX_CHECKS kontrol sonrası hala tamamlanmadı"
echo "Manuel kontrol için: https://github.com/nikolatesla-777/new-goalgpt/actions"
exit 2


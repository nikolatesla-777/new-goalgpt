#!/bin/bash

# GoalGPT Production Monitoring Script
# Real-time monitoring of lazy loading performance and system health
# Usage: ./scripts/monitor-production.sh

set -e

VPS_HOST="142.93.103.128"
VPS_USER="root"
VPS_PASS="Qawsed.3535"

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        GoalGPT Production Monitoring Dashboard              ║${NC}"
echo -e "${BLUE}║        Real-time Lazy Loading Performance                    ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to execute SSH commands
ssh_exec() {
    sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" "$1"
}

# Function to format time
format_uptime() {
    local seconds=$1
    local days=$((seconds / 86400))
    local hours=$(( (seconds % 86400) / 3600 ))
    local minutes=$(( (seconds % 3600) / 60 ))

    if [ $days -gt 0 ]; then
        echo "${days}d ${hours}h ${minutes}m"
    elif [ $hours -gt 0 ]; then
        echo "${hours}h ${minutes}m"
    else
        echo "${minutes}m"
    fi
}

# Section 1: System Status
echo -e "${GREEN}[1/6] SYSTEM STATUS${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Get PM2 status
PM2_STATUS=$(ssh_exec "pm2 jlist" 2>/dev/null)

# Parse backend status
BACKEND_STATUS=$(echo "$PM2_STATUS" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    backend = next((p for p in data if p['name'] == 'goalgpt-backend'), None)
    if backend:
        print(f\"Status: {backend['pm2_env']['status']}\")
        print(f\"PID: {backend['pid']}\")
        print(f\"Uptime: {backend['pm2_env']['pm_uptime']}\")
        print(f\"Restarts: {backend['pm2_env']['restart_time']}\")
        print(f\"CPU: {backend['monit']['cpu']}%\")
        print(f\"Memory: {backend['monit']['memory'] // 1024 // 1024}MB\")
    else:
        print('Status: NOT FOUND')
except:
    print('Status: ERROR')
" 2>/dev/null) || echo "Status: ERROR parsing PM2 data"

echo "$BACKEND_STATUS" | while IFS=: read -r key value; do
    if [[ "$key" == "Status" && "$value" =~ "online" ]]; then
        echo -e "  ${GREEN}✓${NC} $key:$value"
    elif [[ "$key" == "Status" ]]; then
        echo -e "  ${RED}✗${NC} $key:$value"
    else
        echo -e "  ${BLUE}•${NC} $key:$value"
    fi
done

echo ""

# Section 2: Endpoint Performance Test
echo -e "${GREEN}[2/6] API ENDPOINT PERFORMANCE${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

MATCH_ID="4jwq2ghn1ox0m0v"
ENDPOINTS=("incidents" "live-stats" "h2h" "lineup" "trend")

for endpoint in "${ENDPOINTS[@]}"; do
    RESULT=$(curl -s -w '\n%{http_code}|%{time_total}|%{size_download}' \
        -o /dev/null "https://partnergoalgpt.com/api/matches/$MATCH_ID/$endpoint")

    STATUS=$(echo "$RESULT" | tail -1 | cut -d'|' -f1)
    TIME=$(echo "$RESULT" | tail -1 | cut -d'|' -f2)
    SIZE=$(echo "$RESULT" | tail -1 | cut -d'|' -f3)

    # Convert time to ms
    TIME_MS=$(echo "$TIME * 1000" | bc | cut -d'.' -f1)

    # Color based on performance
    if [ "$STATUS" = "200" ]; then
        if [ $TIME_MS -lt 300 ]; then
            COLOR=$GREEN
            ICON="✓"
        elif [ $TIME_MS -lt 1000 ]; then
            COLOR=$YELLOW
            ICON="⚠"
        else
            COLOR=$RED
            ICON="✗"
        fi
        printf "  ${COLOR}${ICON}${NC} %-15s | Status: %s | Time: %4dms | Size: %6s bytes\n" \
            "/$endpoint" "$STATUS" "$TIME_MS" "$SIZE"
    else
        printf "  ${RED}✗${NC} %-15s | Status: %s | FAILED\n" \
            "/$endpoint" "$STATUS"
    fi
done

echo ""

# Section 3: Recent Traffic Analysis
echo -e "${GREEN}[3/6] RECENT TRAFFIC (Last 100 requests)${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

TRAFFIC=$(ssh_exec "tail -100 /var/log/nginx/access.log | grep -E 'api/matches/[a-z0-9]+/(incidents|live-stats|h2h|lineup|trend)' | wc -l")
echo -e "  ${BLUE}•${NC} Tab API requests: $TRAFFIC"

MATCH_PAGES=$(ssh_exec "tail -100 /var/log/nginx/access.log | grep -E '/match/[a-z0-9]+/(stats|events|h2h|lineup|trend|ai|standings)' | wc -l")
echo -e "  ${BLUE}•${NC} Match detail page visits: $MATCH_PAGES"

INCIDENTS_CALLS=$(ssh_exec "tail -100 /var/log/nginx/access.log | grep -c '/incidents' || echo 0")
echo -e "  ${BLUE}•${NC} Incidents endpoint calls: $INCIDENTS_CALLS ${GREEN}(NEW optimized)${NC}"

echo ""

# Section 4: Live Matches
echo -e "${GREEN}[4/6] LIVE MATCH STATUS${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

LIVE_MATCHES=$(curl -s 'https://partnergoalgpt.com/api/matches/live' | \
    python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    matches = data.get('data', {}).get('matches', [])
    print(f'Total live matches: {len(matches)}')
    for m in matches[:3]:
        home = m.get('home_team', {}).get('name', 'Unknown')
        away = m.get('away_team', {}).get('name', 'Unknown')
        status = m.get('status_id', 'N/A')
        score = f\"{m.get('home_score', 0)}-{m.get('away_score', 0)}\"
        print(f'  • {home} {score} {away} (Status: {status})')
except:
    print('Error fetching live matches')
" 2>/dev/null) || echo "  Error fetching live match data"

echo "$LIVE_MATCHES"
echo ""

# Section 5: Error Log Check
echo -e "${GREEN}[5/6] ERROR LOG STATUS${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

ERROR_COUNT=$(ssh_exec "tail -100 /root/.pm2/logs/goalgpt-backend-error.log 2>/dev/null | wc -l" || echo "0")

if [ "$ERROR_COUNT" -eq 0 ]; then
    echo -e "  ${GREEN}✓${NC} No errors in last 100 log lines"
else
    echo -e "  ${YELLOW}⚠${NC} Found $ERROR_COUNT error lines"
    echo ""
    echo "Recent errors:"
    ssh_exec "tail -5 /root/.pm2/logs/goalgpt-backend-error.log 2>/dev/null" | sed 's/^/    /'
fi

echo ""

# Section 6: Lazy Loading Verification
echo -e "${GREEN}[6/6] LAZY LOADING VERIFICATION${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if frontend is serving new bundle
BUNDLE=$(curl -s https://partnergoalgpt.com/ | grep -o 'index-[^"]*\.js' | head -1)
if [[ "$BUNDLE" == "index-CtOm1Eu6.js" ]]; then
    echo -e "  ${GREEN}✓${NC} Frontend bundle: $BUNDLE (Latest)"
else
    echo -e "  ${YELLOW}⚠${NC} Frontend bundle: $BUNDLE (Expected: index-CtOm1Eu6.js)"
fi

# Check TypeScript compilation
INCIDENTS_SERVICE=$(ssh_exec "ls -la /var/www/goalgpt/dist/services/thesports/match/ | grep -c 'matchIncidents.service.js' || echo 0")
if [ "$INCIDENTS_SERVICE" -eq 1 ]; then
    echo -e "  ${GREEN}✓${NC} Backend compiled: matchIncidents.service.js exists"
else
    echo -e "  ${RED}✗${NC} Backend compiled: matchIncidents.service.js NOT FOUND"
fi

# Database-first pattern check
DB_RESPONSE_TIME=$(curl -s -w '%{time_total}' -o /dev/null "https://partnergoalgpt.com/api/matches/$MATCH_ID/incidents")
DB_TIME_MS=$(echo "$DB_RESPONSE_TIME * 1000" | bc | cut -d'.' -f1)
if [ $DB_TIME_MS -lt 500 ]; then
    echo -e "  ${GREEN}✓${NC} Database-first pattern: Working ($DB_TIME_MS ms)"
else
    echo -e "  ${YELLOW}⚠${NC} Database-first pattern: Slow ($DB_TIME_MS ms)"
fi

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                  Monitoring Complete                         ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "💡 Tips:"
echo "  - Run with 'watch -n 10' for continuous monitoring"
echo "  - Check full logs: ssh root@$VPS_HOST 'pm2 logs goalgpt-backend'"
echo "  - View access logs: ssh root@$VPS_HOST 'tail -f /var/log/nginx/access.log'"
echo ""

#!/bin/bash

# Real-time Production Log Watcher
# Monitors backend logs and nginx access logs for lazy loading patterns
# Usage: ./scripts/watch-logs.sh [backend|nginx|incidents|all]

set -e

VPS_HOST="142.93.103.128"
VPS_USER="root"
VPS_PASS="Qawsed.3535"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

MODE="${1:-all}"

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           GoalGPT Production Log Watcher                     ║${NC}"
echo -e "${BLUE}║           Mode: $MODE${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

case "$MODE" in
  backend)
    echo -e "${GREEN}Watching backend logs (PM2)...${NC}"
    echo -e "${YELLOW}Press Ctrl+C to exit${NC}"
    echo ""
    sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" \
      "pm2 logs goalgpt-backend --lines 50"
    ;;

  nginx)
    echo -e "${GREEN}Watching nginx access logs (API calls only)...${NC}"
    echo -e "${YELLOW}Press Ctrl+C to exit${NC}"
    echo ""
    sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" \
      "tail -f /var/log/nginx/access.log | grep --line-buffered -E 'api/'"
    ;;

  incidents)
    echo -e "${GREEN}Watching incidents endpoint calls (NEW optimized)...${NC}"
    echo -e "${YELLOW}Press Ctrl+C to exit${NC}"
    echo ""
    echo "Timestamp                 | Status | Time     | Match ID"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" \
      "tail -f /var/log/nginx/access.log | grep --line-buffered '/incidents' | \
       awk '{
         split(\$4, dt, \":\");
         time = substr(\$4, 2) \" \" \$5;
         status = \$9;
         url = \$7;
         split(url, parts, \"/\");
         match_id = parts[4];
         printf \"%-25s | %6s | Logged   | %s\n\", time, status, match_id;
       }'"
    ;;

  all)
    echo -e "${GREEN}Watching all logs (combined view)...${NC}"
    echo -e "${YELLOW}Press Ctrl+C to exit${NC}"
    echo ""
    echo -e "${BLUE}Legend:${NC}"
    echo -e "  ${GREEN}[API]${NC}     - Nginx access log (API calls)"
    echo -e "  ${YELLOW}[BACKEND]${NC} - PM2 backend log"
    echo -e "  ${RED}[ERROR]${NC}   - PM2 error log"
    echo ""

    sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" \
      "tail -f /var/log/nginx/access.log /root/.pm2/logs/goalgpt-backend-out.log /root/.pm2/logs/goalgpt-backend-error.log | \
       awk '
         /access.log/ && /api\// {
           split(\$4, dt, \":\");
           time = substr(\$4, 2);
           method = \$6;
           url = \$7;
           status = \$9;
           if (url ~ /incidents/) {
             printf \"\\033[0;32m[API]\\033[0m     %s | %s | %s %s\\n\", time, status, method, url;
           } else if (url ~ /api\/matches\/[a-z0-9]+\//) {
             printf \"\\033[0;32m[API]\\033[0m     %s | %s | %s %s\\n\", time, status, method, url;
           }
         }
         /goalgpt-backend-out.log/ {
           gsub(/^==> .* <==$/, \"\");
           if (\$0 != \"\") {
             printf \"\\033[1;33m[BACKEND]\\033[0m %s\\n\", \$0;
           }
         }
         /goalgpt-backend-error.log/ {
           gsub(/^==> .* <==$/, \"\");
           if (\$0 != \"\") {
             printf \"\\033[0;31m[ERROR]\\033[0m   %s\\n\", \$0;
           }
         }
       '"
    ;;

  *)
    echo -e "${RED}Error: Invalid mode '$MODE'${NC}"
    echo ""
    echo "Usage: $0 [backend|nginx|incidents|all]"
    echo ""
    echo "Modes:"
    echo "  backend    - Watch backend PM2 logs"
    echo "  nginx      - Watch nginx access logs (all API calls)"
    echo "  incidents  - Watch only incidents endpoint calls (NEW)"
    echo "  all        - Watch all logs combined (default)"
    exit 1
    ;;
esac

#!/bin/bash
set -euo pipefail

PROJECT="/Users/utkubozbay/Desktop/project"
PORT="3000"
DATE="2025-12-22"
OUT="$PROJECT/proof/phase3c3_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$OUT"

echo "=== [1/8] Preflight ===" | tee "$OUT/00_preflight.txt"
cd "$PROJECT"
node -v | tee -a "$OUT/00_preflight.txt"
npm -v  | tee -a "$OUT/00_preflight.txt"

echo "=== [2/8] Install (if needed) ===" | tee "$OUT/01_install.txt"
npm ci 2>&1 | tee "$OUT/01_install.txt" || echo "npm ci failed, continuing..." | tee -a "$OUT/01_install.txt"

echo "=== [3/8] Start server (background) ===" | tee "$OUT/02_server_start.txt"
# Server start komutunu projendeki script adına göre seç:
START_CMD=""
if npm run -s 2>/dev/null | grep -q "start:dev"; then START_CMD="npm run start:dev"
elif npm run -s 2>/dev/null | grep -q "dev"; then START_CMD="npm run dev"
else START_CMD="npm run start"
fi
echo "Using START_CMD=$START_CMD" | tee -a "$OUT/02_server_start.txt"

# Log dosyası
LOGFILE="$OUT/server.log"
( $START_CMD ) >"$LOGFILE" 2>&1 &
SERVER_PID=$!
echo "SERVER_PID=$SERVER_PID" | tee -a "$OUT/02_server_start.txt"

echo "=== [4/8] Wait for port $PORT ===" | tee "$OUT/03_wait_port.txt"
for i in $(seq 1 60); do
  if curl -s "http://localhost:$PORT/health" >/dev/null 2>&1; then
    echo "health OK (attempt $i)" | tee -a "$OUT/03_wait_port.txt"
    break
  fi
  # health yoksa port açıldı mı diye kontrol et
  if curl -s "http://localhost:$PORT" >/dev/null 2>&1; then
    echo "port responding (attempt $i)" | tee -a "$OUT/03_wait_port.txt"
    break
  fi
  sleep 1
  if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    echo "Server crashed early. Printing last 200 lines:" | tee -a "$OUT/03_wait_port.txt"
    tail -n 200 "$LOGFILE" | tee -a "$OUT/03_wait_port.txt"
    exit 1
  fi
done

echo "=== [5/8] API Proof: diary + live ===" | tee "$OUT/04_api_proof.txt"
echo "--- CURL diary?date=$DATE ---" | tee -a "$OUT/04_api_proof.txt"
curl -s "http://localhost:$PORT/api/matches/diary?date=$DATE" > "$OUT/diary.json"
wc -c "$OUT/diary.json" | tee -a "$OUT/04_api_proof.txt"
head -c 2000 "$OUT/diary.json" | tee -a "$OUT/04_api_proof.txt"
echo "" | tee -a "$OUT/04_api_proof.txt"

echo "--- CURL live ---" | tee -a "$OUT/04_api_proof.txt"
curl -s "http://localhost:$PORT/api/matches/live" > "$OUT/live.json"
wc -c "$OUT/live.json" | tee -a "$OUT/04_api_proof.txt"
head -c 2000 "$OUT/live.json" | tee -a "$OUT/04_api_proof.txt"
echo "" | tee -a "$OUT/04_api_proof.txt"

echo "=== [6/8] DB Proof (counts) ===" | tee "$OUT/05_db_proof.txt"
# DB connection import'u projene göre uyumlu: ./src/database/connection içindeki pool kullanımı
npx -y tsx -e "
import { pool } from './src/database/connection';
(async () => {
  const client = await pool.connect();
  try {
    const start = Math.floor(new Date('2025-12-21T21:00:00Z').getTime()/1000);
    const end   = Math.floor(new Date('2025-12-22T21:00:00Z').getTime()/1000);

    const q1 = await client.query('SELECT COUNT(*)::int AS c FROM ts_matches WHERE match_time >= \$1 AND match_time < \$2', [start, end]);
    console.log('DB COUNT (TSI day window) =', q1.rows[0].c);

    const q2 = await client.query(
      'SELECT status_id, COUNT(*)::int AS c FROM ts_matches WHERE match_time >= \$1 AND match_time < \$2 GROUP BY status_id ORDER BY status_id',
      [start, end]
    );
    console.log('STATUS BREAKDOWN:');
    for (const r of q2.rows) console.log('  status_id=', r.status_id, 'count=', r.c);

    const q3 = await client.query(
      'SELECT COUNT(*)::int AS c FROM ts_matches WHERE match_time >= \$1 AND match_time < \$2 AND status_id IN (2,3,4,5,7)',
      [start, end]
    );
    console.log('LIVE COUNT (2,3,4,5,7) =', q3.rows[0].c);

    const q4 = await client.query(
      'SELECT external_id, status_id, minute, match_time FROM ts_matches WHERE match_time >= \$1 AND match_time < \$2 ORDER BY match_time ASC LIMIT 3',
      [start, end]
    );
    console.log('SAMPLE (first 3):');
    for (const r of q4.rows) console.log(r);
  } finally {
    client.release();
    await pool.end();
  }
})();" 2>&1 | tee "$OUT/05_db_proof.txt"

echo "=== [7/8] Runtime Proof: worker logs (best-effort) ===" | tee "$OUT/06_runtime_proof.txt"
# Kendi log sistemin: /tmp/goalgpt-server.log varsa oradan da çekelim
if [ -f /tmp/goalgpt-server.log ]; then
  echo "--- /tmp/goalgpt-server.log (last 200 lines) ---" | tee -a "$OUT/06_runtime_proof.txt"
  tail -n 200 /tmp/goalgpt-server.log | tee -a "$OUT/06_runtime_proof.txt"
else
  echo "/tmp/goalgpt-server.log not found, using local server.log" | tee -a "$OUT/06_runtime_proof.txt"
fi
echo "--- server.log (last 250 lines) ---" | tee -a "$OUT/06_runtime_proof.txt"
tail -n 250 "$LOGFILE" | tee -a "$OUT/06_runtime_proof.txt"

echo "=== [8/8] Stop server ===" | tee "$OUT/07_stop.txt"
kill "$SERVER_PID" >/dev/null 2>&1 || true
sleep 1
kill -9 "$SERVER_PID" >/dev/null 2>&1 || true

echo ""
echo "✅ PHASE 3C-3 PROOF ARTIFACTS READY:"
echo "   $OUT"
echo "   - diary.json, live.json"
echo "   - 04_api_proof.txt, 05_db_proof.txt, 06_runtime_proof.txt"
echo "   - server.log"





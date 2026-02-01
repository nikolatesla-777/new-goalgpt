# PUAN DURUMU SİSTEMİ - MİMARİ DÖKÜMAN

**Tarih**: 1 Şubat 2026
**Sistem**: GoalGPT - Süper Lig Puan Durumu
**Versiyon**: 2.0 (Frontend Entegreli)

---

## 🏗️ SİSTEM MİMARİSİ

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER (ADMIN PANEL)                               │
│                  https://partnergoalgpt.com/admin/league-standings       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP GET Request
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    FRONTEND: SuperLigStandingsPage.tsx                   │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ • Competition ID: 8y39mp1h6jmojxg (hardcoded)                     │  │
│  │ • API Call: GET /api/admin/standings/8y39mp1h6jmojxg             │  │
│  │ • Renders: 18 teams with full stats                               │  │
│  │ • Visual indicators: TheSports (yellow) vs Calculated (green)     │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP GET /api/admin/standings/:id
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│               BACKEND: standings.routes.ts (Admin API)                   │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Step 1: SELECT ts_standings (raw TheSports data)                  │  │
│  │         WHERE competition_id = '8y39mp1h6jmojxg'                  │  │
│  │         AND season year LIKE '%2025%' OR '%2026%'                 │  │
│  │                                                                    │  │
│  │ Step 2: SELECT ts_teams (team names)                              │  │
│  │                                                                    │  │
│  │ Step 3: FOR EACH team (18 teams):                                 │  │
│  │         SELECT ts_matches (last 20 matches, status_id = 8)        │  │
│  │         Calculate:                                                 │  │
│  │         • Last 5 form (W/D/L array)                               │  │
│  │         • PPG = points / matches_played                           │  │
│  │         • CS% = clean_sheets / total_matches * 100                │  │
│  │         • BTTS% = both_scored / total_matches * 100               │  │
│  │         • Over 1.5% = (total_goals > 1) / total_matches * 100     │  │
│  │         • Over 2.5% = (total_goals > 2) / total_matches * 100     │  │
│  │         • AVG = total_goals_scored / total_matches                │  │
│  │         • xGF = average xG (if available)                          │  │
│  │                                                                    │  │
│  │ Step 4: Merge TheSports + Calculated                              │  │
│  │         Return JSON response                                       │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Response JSON
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           RESPONSE FORMAT                                │
│  {                                                                        │
│    "competition_id": "8y39mp1h6jmojxg",                                 │
│    "season_id": "4zp5rzgh8xvq82w",                                      │
│    "updated_at": "2026-02-01T14:21:01.000Z",                            │
│    "standings": [                                                        │
│      {                                                                   │
│        "position": 1,                 // ← TheSports                     │
│        "team_name": "Galatasaray",    // ← TheSports                     │
│        "mp": 19,                      // ← TheSports                     │
│        "won": 14,                     // ← TheSports                     │
│        "draw": 4,                     // ← TheSports                     │
│        "loss": 1,                     // ← TheSports                     │
│        "goals_for": 43,               // ← TheSports                     │
│        "goals_against": 14,           // ← TheSports                     │
│        "goal_diff": 29,               // ← TheSports                     │
│        "points": 46,                  // ← TheSports                     │
│        "last_5": ["W","W","W","D","W"], // ← Calculated (ts_matches)    │
│        "ppg": 2.42,                   // ← Calculated                    │
│        "cs_percent": 37,              // ← Calculated                    │
│        "btts_percent": 53,            // ← Calculated                    │
│        "xgf": null,                   // ← Calculated (often N/A)        │
│        "over_15_percent": 79,         // ← Calculated                    │
│        "over_25_percent": 63,         // ← Calculated                    │
│        "avg_goals": 2.21              // ← Calculated                    │
│      },                                                                  │
│      // ... 17 more teams                                               │
│    ]                                                                     │
│  }                                                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 VERİ KAYNAKLARI

### 1. TheSports API → ts_standings

**Source**: `https://api.thesports.com/v1/football/season/recent/table/detail`

**Senkronizasyon**:
- Job: `standingsAutoSyncV2.job.ts`
- Frequency: Her 5 dakika
- Priority leagues: Süper Lig HER ZAMAN sync edilir
- Other leagues: Sadece `/data/update` feed'de olanlar

**Stored Data** (ts_standings table):
```sql
CREATE TABLE ts_standings (
  season_id TEXT PRIMARY KEY,
  standings JSONB,              -- TheSports rows array
  raw_response JSONB,           -- Full API response
  updated_at TIMESTAMPTZ
);
```

**TheSports Fields**:
- `position` - Sıra
- `total` - Oynanan maç (MP)
- `won` - Galibiyet (W)
- `draw` - Beraberlik (D)
- `loss` - Mağlubiyet (L)
- `goals` - Attığı gol (GF)
- `goals_against` - Yediği gol (GA)
- `goal_diff` - Averaj (GD)
- `points` - Puan (Pts)

### 2. Calculated Stats → ts_matches

**Source**: PostgreSQL query on `ts_matches` table

**Filter**:
- `status_id = 8` (Finished matches only)
- `season_id = '4zp5rzgh8xvq82w'` (2025-2026 season)
- `home_team_id = X OR away_team_id = X` (Team's matches)
- `ORDER BY match_time DESC LIMIT 20` (Last 20 matches)

**Calculated Fields**:

```typescript
// 1. Last 5 Form
const last5Form: string[] = [];
for (match in last_5_matches) {
  if (teamScore > opponentScore) last5Form.push('W');
  else if (teamScore < opponentScore) last5Form.push('L');
  else last5Form.push('D');
}
// Example: ["W", "W", "D", "L", "W"]

// 2. PPG (Points Per Game)
const ppg = points / matches_played;
// Example: 46 / 19 = 2.42

// 3. CS% (Clean Sheet Percentage)
const cleanSheets = matches.filter(m => opponentScore === 0).length;
const cs_percent = Math.round((cleanSheets / matches.length) * 100);
// Example: 7 / 19 = 37%

// 4. BTTS% (Both Teams To Score)
const btts = matches.filter(m => teamScore > 0 && opponentScore > 0).length;
const btts_percent = Math.round((btts / matches.length) * 100);
// Example: 10 / 19 = 53%

// 5. Over 1.5%
const over15 = matches.filter(m => (teamScore + opponentScore) > 1).length;
const over_15_percent = Math.round((over15 / matches.length) * 100);
// Example: 15 / 19 = 79%

// 6. Over 2.5%
const over25 = matches.filter(m => (teamScore + opponentScore) > 2).length;
const over_25_percent = Math.round((over25 / matches.length) * 100);
// Example: 12 / 19 = 63%

// 7. AVG Goals (Team's goals only)
const totalGoals = matches.reduce((sum, m) => sum + teamScore, 0);
const avg_goals = totalGoals / matches.length;
// Example: 42 / 19 = 2.21

// 8. xGF (Expected Goals For)
const xgMatches = matches.filter(m => m.statistics?.xg);
if (xgMatches.length > 0) {
  const totalXg = xgMatches.reduce((sum, m) => sum + xgValue, 0);
  const xgf = totalXg / xgMatches.length;
} else {
  xgf = null; // Often N/A
}
```

---

## 🔄 AUTO-SYNC JOB

### standingsAutoSyncV2.job.ts

**Purpose**: Otomatik puan durumu senkronizasyonu

**Workflow**:
```
1. Load priority leagues from config/priority_leagues.json
   └─> Süper Lig (8y39mp1h6jmojxg) → season_id: 4zp5rzgh8xvq82w

2. Fetch /data/update from TheSports API
   └─> Recent changes (last 120 seconds)
   └─> Keys: "3" (matches), "4" (seasons), "5" (competitions), "6" (teams)

3. Extract season IDs from recent updates

4. Merge: priority_leagues + recent_updates
   └─> Unique season IDs

5. Filter: Only 2025-2026 seasons
   WHERE (year IN ('2025', '2026') OR year LIKE '%2025%' OR year LIKE '%2026%')

6. FOR EACH season_id:
   a. Fetch standings: /season/recent/table/detail?uuid={season_id}
   b. Save to ts_standings (UPSERT on conflict)
   c. Rate limit: 500ms delay between requests

7. Return sync results
   └─> Total synced, errors, duration
```

**PM2 Setup**:
```bash
pm2 start src/jobs/standingsAutoSyncV2.job.ts \
  --name standings-sync \
  --cron "*/5 * * * *"
```

**Manual Run**:
```bash
npx tsx src/jobs/standingsAutoSyncV2.job.ts
```

---

## 🎨 FRONTEND GÖRSEL STRATEJİ

### Renk Kodları

| Veri Tipi | Renk | CSS Class | Açıklama |
|-----------|------|-----------|----------|
| **TheSports Kolonları** | 🟡 Sarı | `bg-yellow-900/20` | API'den gelen direkt veri |
| **Hesaplanmış Kolonları** | 🟢 Yeşil | `bg-green-900/20` | ts_matches'tan hesaplanan |
| **Top 5 Pozisyon** | 🟢 Yeşil | Text `text-green-400` | Avrupa kupalarına gidiş |
| **Bottom 3 Pozisyon** | 🔴 Kırmızı | Text `text-red-400` | Düşme hattı |

### Form Badges

```tsx
// Son 5 maç formu
<div className="flex gap-1">
  {team.last_5.map((result, index) => (
    <div
      key={index}
      className={`
        w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
        ${result === 'W' ? 'bg-green-500 text-white' : ''}
        ${result === 'D' ? 'bg-yellow-500 text-gray-900' : ''}
        ${result === 'L' ? 'bg-red-500 text-white' : ''}
      `}
    >
      {result}
    </div>
  ))}
</div>
```

**Görünüm**: 🟢W 🟢W 🟡D 🔴L 🟢W

### Toggle Detay Paneli

```tsx
const [showDetails, setShowDetails] = useState(false);

// Banner kısmı
{showDetails && (
  <div className="mt-4 grid grid-cols-2 gap-4">
    {/* TheSports Kolonları */}
    <div className="bg-yellow-900/20 border border-yellow-700/30 p-4">
      <h4>📡 TheSports API</h4>
      <ul className="space-y-1">
        <li>✓ Position, MP, W, D, L</li>
        <li>✓ GF, GA, GD, Points</li>
        <li>✓ Kaynak: ts_standings tablosu</li>
      </ul>
    </div>

    {/* Hesaplanmış Kolonları */}
    <div className="bg-green-900/20 border border-green-700/30 p-4">
      <h4>🧮 Hesaplanmış İstatistikler</h4>
      <ul className="space-y-1">
        <li>✓ Last 5 Form (ts_matches)</li>
        <li>✓ PPG, CS%, BTTS%</li>
        <li>✓ Over 1.5%, Over 2.5%</li>
        <li>✓ AVG goals</li>
      </ul>
    </div>
  </div>
)}
```

---

## 🧪 TEST & VERİFİKASYON

### Backend Test

```bash
# 1. Test script çalıştır
npx tsx src/scripts/test-full-standings-table.ts

# Beklenen output:
# ✅ 18 teams
# ✅ All columns present
# ✅ Trabzonspor 42 points ✓
```

### API Test

```bash
curl -X GET "http://localhost:3000/api/admin/standings/8y39mp1h6jmojxg" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" | jq
```

**Validation**:
- ✅ 18 teams in array
- ✅ Trabzonspor position: 3
- ✅ Trabzonspor points: 42
- ✅ All 18 fields present per team

### Frontend Test

```bash
# 1. Build frontend
cd frontend
npm run build

# 2. Check build output
ls -lh dist/assets/*.js

# 3. Deploy to VPS (if needed)
scp -r dist/* root@142.93.103.128:/var/www/goalgpt/frontend/dist/

# 4. Open in browser
https://partnergoalgpt.com/admin/league-standings
```

**Checklist**:
- [ ] Sadece Süper Lig gösteriliyor (18 takım)
- [ ] Trabzonspor 42 puan gösteriyor
- [ ] Renk kodları doğru (sarı TheSports, yeşil hesaplanmış)
- [ ] Toggle detay paneli açılıp kapanıyor
- [ ] Son 5 form badges render ediliyor (W/D/L)
- [ ] Pozisyon göstergeleri çalışıyor (top 5 yeşil, bottom 3 kırmızı)
- [ ] Sync butonu çalışıyor (manuel güncelleme)
- [ ] Son güncelleme zamanı gösteriliyor

---

## 📊 PERFORMANS

### Backend Response Time

```
GET /api/admin/standings/8y39mp1h6jmojxg

┌─────────────────────┬──────────┐
│ Operation           │ Time     │
├─────────────────────┼──────────┤
│ SELECT ts_standings │ ~50ms    │
│ SELECT ts_teams     │ ~30ms    │
│ FOR EACH team (18): │          │
│   SELECT ts_matches │ ~20ms    │
│   Calculate stats   │ ~5ms     │
├─────────────────────┼──────────┤
│ TOTAL               │ ~500ms   │
└─────────────────────┴──────────┘
```

**Optimization Opportunities** (future):
- Batch query for all teams' matches (single query vs 18 queries)
- Redis caching (5-minute TTL)
- Pre-calculate stats in background job

### Database Queries

**Current**: 20 queries (1 standings + 1 teams + 18 matches)
**Optimized** (future): 3 queries (1 standings + 1 teams + 1 batched matches)

---

## 🚀 DEPLOYMENT

### 1. Backend Deploy

```bash
# SSH to VPS
ssh root@142.93.103.128

# Navigate to project
cd /var/www/goalgpt

# Pull latest code
git pull

# Install dependencies (if needed)
npm install

# Build backend
npm run build

# Restart backend
pm2 restart goalgpt

# Check logs
pm2 logs goalgpt --lines 50
```

### 2. Frontend Deploy

```bash
# Local machine - build frontend
cd frontend
npm run build

# Copy to VPS
scp -r dist/* root@142.93.103.128:/var/www/goalgpt/frontend/dist/

# OR: If nginx serves from different location
scp -r dist/* root@142.93.103.128:/var/www/html/
```

### 3. Auto-Sync Job (PM2)

```bash
# Start job (if not running)
pm2 start /var/www/goalgpt/src/jobs/standingsAutoSyncV2.job.ts \
  --name standings-sync \
  --interpreter npx \
  --interpreter-args "tsx" \
  --cron "*/5 * * * *"

# Check status
pm2 list

# View logs
pm2 logs standings-sync --lines 100

# Stop job
pm2 stop standings-sync

# Restart job
pm2 restart standings-sync
```

---

## 📝 TROUBLESHOOTING

### Problem 1: Trabzonspor 41 puan (yanlış)

**Sebep**: Süper Lig `/data/update` feed'de değildi (son 120 saniye maç yok)

**Çözüm**: Priority leagues sistemi
```json
// config/priority_leagues.json
{
  "priority_leagues": [
    {
      "name": "Turkish Super League",
      "ts_competition_id": "8y39mp1h6jmojxg",
      "season_2025_2026_id": "4zp5rzgh8xvq82w"
    }
  ]
}
```

**Sonuç**: Süper Lig HER ZAMAN sync edilir ✅

### Problem 2: Frontend göstermiyor

**Kontrol**:
```bash
# 1. Backend API çalışıyor mu?
curl http://localhost:3000/api/admin/standings/8y39mp1h6jmojxg

# 2. Frontend build doğru mu?
ls frontend/dist/index.html

# 3. Route tanımlı mı?
grep -r "league-standings" frontend/src/config/admin.registry.ts

# 4. Export doğru mu?
grep -r "SuperLigStandingsPage" frontend/src/components/admin/index.ts
```

### Problem 3: Eksik istatistikler

**Kontrol**:
```bash
# Test script çalıştır
npx tsx src/scripts/test-full-standings-table.ts

# Maç sayısını kontrol et
psql $DATABASE_URL -c "
  SELECT team_id, COUNT(*) as match_count
  FROM ts_matches
  WHERE season_id = '4zp5rzgh8xvq82w'
    AND status_id = 8
  GROUP BY team_id;
"
```

**Çözüm**: Maç verisi yoksa → matchSync.job.ts çalıştır

---

## 📚 REFERANSLAR

### API Endpoints

- **TheSports**: `/season/recent/table/detail?uuid={season_id}`
- **Admin**: `GET /api/admin/standings/:competitionId`
- **Sync**: `POST /api/admin/standings/sync/:competitionId`

### Dosyalar

**Backend**:
- `src/routes/admin/standings.routes.ts`
- `src/jobs/standingsAutoSyncV2.job.ts`
- `src/config/priority_leagues.json`
- `src/scripts/test-full-standings-table.ts`

**Frontend**:
- `frontend/src/components/admin/SuperLigStandingsPage.tsx`
- `frontend/src/components/admin/index.ts`
- `frontend/src/config/admin.registry.ts`

**Raporlar**:
- `STANDINGS-FINAL-SUMMARY.md`
- `SUPERLIG-STANDINGS-INTEGRATION.md`
- `STANDINGS-SYSTEM-ARCHITECTURE.md` (bu dosya)

---

**Hazırlayan**: Claude (AI Assistant)
**Tarih**: 2026-02-01
**Versiyon**: 2.0 (Production Ready)

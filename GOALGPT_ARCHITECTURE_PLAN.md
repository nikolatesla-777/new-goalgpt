# GOALGPT MASTER ARCHITECTURE PLAN

**Tarih:** 18 Ocak 2026
**Versiyon:** 2.0
**Hedef:** Production-grade livescore + AI tahmin sistemi
**Prensip:** TheSports = Single Source of Truth

---

## EXECUTIVE SUMMARY

Bu plan, GoalGPT projesini mevcut karmaşık yapıdan temiz, sürdürülebilir bir mimariye dönüştürmek için hazırlanmıştır.

### Mevcut Durum:
- 34 ayrı job/worker dosyası
- 3x batch sync redundancy
- 3x settlement logic dağınık
- MQTT karmaşıklığı ve hata riski
- FootyStats entegrasyonu yarım kalmış
- Frontend livescore sayfası aktif değil

### Hedef Durum:
- 12-15 konsolide job
- Tek write point (MatchWriterService)
- Event-driven settlement
- REST-first, MQTT opsiyonel
- FootyStats tam entegre
- Mackolik/AiScore kalitesinde livescore

---

## DATA HIERARCHY VISION

```
                    ┌─────────────────┐
                    │    COUNTRY      │
                    │   (Türkiye)     │
                    └────────┬────────┘
                             │
           ┌─────────────────┼─────────────────┐
           ▼                 ▼                 ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │ COMPETITION  │  │ COMPETITION  │  │ COMPETITION  │
    │ Süper Lig    │  │ 1. Lig       │  │ Türkiye Kupası│
    └──────┬───────┘  └──────────────┘  └──────────────┘
           │
     ┌─────┴─────┬─────────────┬─────────────┐
     ▼           ▼             ▼             ▼
┌─────────┐ ┌─────────┐  ┌─────────┐  ┌─────────┐
│  TEAM   │ │  TEAM   │  │  TEAM   │  │  TEAM   │
│ GS      │ │ FB      │  │ BJK     │  │ TS      │
└────┬────┘ └─────────┘  └─────────┘  └─────────┘
     │
     ├──────────────┬──────────────┐
     ▼              ▼              ▼
┌─────────┐  ┌─────────┐    ┌─────────┐
│ PLAYER  │  │ PLAYER  │    │ PLAYER  │
│ Icardi  │  │ Mertens │    │ Torreira│
└─────────┘  └─────────┘    └─────────┘
```

### Data Sources:
```
┌─────────────────────────────────────────────────────────────────┐
│                    THESPORTS API                                 │
│              (SINGLE SOURCE OF TRUTH)                           │
│                                                                  │
│  • Matches (ts_matches)                                         │
│  • Teams (ts_teams)                                             │
│  • Players (ts_players)                                         │
│  • Competitions (ts_competitions)                               │
│  • Countries (ts_countries)                                     │
│  • Live Scores (WebSocket + REST)                               │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────────┐ ┌─────────────────┐ ┌─────────────────────┐
│   AI PREDICTIONS    │ │   FOOTYSTATS    │ │    USER DATA        │
│   (External)        │ │   (Stats)       │ │    (Forum/Favorites)│
│                     │ │                 │ │                     │
│ Mapped via:         │ │ Mapped via:     │ │ Linked via:         │
│ • TeamNameMatcher   │ │ • integration_  │ │ • ts_id foreign key │
│ • Fuzzy matching    │ │   mappings      │ │ • match_comments    │
│ • ts_team_aliases   │ │ • ts↔fs_id      │ │ • user_favorites    │
└─────────────────────┘ └─────────────────┘ └─────────────────────┘
```

---

## FAZ 1: BACKEND TEMİZLİĞİ (Öncelik: KRİTİK)

### 1.1 JOB KONSOLİDASYONU

#### Mevcut Job Envanteri (34 dosya):

| Kategori | Job | Satır | Aksiyon |
|----------|-----|-------|---------|
| **MATCH SYNC** | dailyMatchSync.job.ts | 711 | ❌ SİL |
| | matchSync.job.ts | 656 | ✅ TUTAN (core) |
| | matchDataSync.job.ts | 509 | 🔄 FALLBACK'e dönüştür |
| | matchWatchdog.job.ts | 1551 | 🔄 BÖLE (2 job) |
| | matchMinute.job.ts | 227 | ✅ TUTAN |
| | matchFreezeDetection.job.ts | 291 | ❌ SİL (watchdog'a merge) |
| | proactiveMatchStatusCheck.job.ts | 232 | ❌ SİL (watchdog'a merge) |
| | lineupRefresh.job.ts | 216 | ❌ SİL (on-demand API) |
| | postMatchProcessor.job.ts | - | ❌ SİL (settlement auto) |
| **DATA SYNC** | dataUpdate.job.ts | 647 | ✅ TUTAN |
| | categorySync.job.ts | - | 🔄 BİRLEŞTİR |
| | coachSync.job.ts | - | 🔄 BİRLEŞTİR |
| | competitionSync.job.ts | - | 🔄 BİRLEŞTİR |
| | countrySync.job.ts | - | 🔄 BİRLEŞTİR |
| | playerSync.job.ts | - | 🔄 BİRLEŞTİR |
| | refereeSync.job.ts | - | 🔄 BİRLEŞTİR |
| | seasonSync.job.ts | - | 🔄 BİRLEŞTİR |
| | stageSync.job.ts | - | 🔄 BİRLEŞTİR |
| | teamSync.job.ts | - | 🔄 BİRLEŞTİR |
| | teamDataSync.job.ts | - | 🔄 BİRLEŞTİR |
| | teamLogoSync.job.ts | - | 🔄 BİRLEŞTİR |
| | venueSync.job.ts | - | 🔄 BİRLEŞTİR |
| **GAMIFICATION** | badgeAutoUnlock.job.ts | - | ✅ TUTAN |
| | referralTier2.job.ts | - | ✅ TUTAN |
| | referralTier3.job.ts | - | ✅ TUTAN |
| | streakBreakWarnings.job.ts | - | ✅ TUTAN |
| | dailyRewardReminders.job.ts | - | ✅ TUTAN |
| **NOTIFICATIONS** | scheduledNotifications.job.ts | - | ✅ TUTAN |
| | subscriptionExpiryAlerts.job.ts | - | ✅ TUTAN |
| **MAINTENANCE** | deadTokenCleanup.job.ts | - | ✅ TUTAN |
| | oldLogsCleanup.job.ts | - | ✅ TUTAN |
| | partnerAnalytics.job.ts | - | ✅ TUTAN |
| **VALIDATION** | dataCompletenessValidator.job.ts | - | ✅ TUTAN |

#### Hedef Job Yapısı (15 job):

```
src/jobs/
├── core/
│   ├── matchSync.job.ts          # Günlük fikstür sync
│   ├── dataUpdate.job.ts         # /data/update API (live data)
│   ├── matchMinute.job.ts        # Dakika hesaplama
│   └── entitySync.job.ts         # BİRLEŞİK: 12 entity sync → 1 job
│
├── watchdog/
│   ├── staleMatchDetector.job.ts # >100 dk stuck maçları tespit
│   └── matchTransition.job.ts    # Proactive status transitions
│
├── gamification/
│   ├── badgeAutoUnlock.job.ts
│   ├── referralTier2.job.ts
│   ├── referralTier3.job.ts
│   ├── streakBreakWarnings.job.ts
│   └── dailyRewardReminders.job.ts
│
├── notifications/
│   ├── scheduledNotifications.job.ts
│   └── subscriptionExpiryAlerts.job.ts
│
├── maintenance/
│   ├── deadTokenCleanup.job.ts
│   ├── oldLogsCleanup.job.ts
│   └── partnerAnalytics.job.ts
│
└── jobManager.ts                  # Merkezi job yönetimi
```

### 1.2 SİLİNECEK DOSYALAR

```bash
# Match Jobs - Redundant
rm src/jobs/dailyMatchSync.job.ts        # matchSync ile duplicate
rm src/jobs/matchFreezeDetection.job.ts  # watchdog'a merge
rm src/jobs/proactiveMatchStatusCheck.job.ts  # watchdog'a merge
rm src/jobs/lineupRefresh.job.ts         # on-demand API yeterli
rm src/jobs/postMatchProcessor.job.ts    # settlement auto olacak

# Entity Sync Jobs - 12 job → 1 job olacak
rm src/jobs/categorySync.job.ts
rm src/jobs/coachSync.job.ts
rm src/jobs/competitionSync.job.ts
rm src/jobs/countrySync.job.ts
rm src/jobs/playerSync.job.ts
rm src/jobs/refereeSync.job.ts
rm src/jobs/seasonSync.job.ts
rm src/jobs/stageSync.job.ts
rm src/jobs/teamSync.job.ts
rm src/jobs/teamDataSync.job.ts
rm src/jobs/teamLogoSync.job.ts
rm src/jobs/venueSync.job.ts
```

### 1.3 YENİ: EntitySync Unified Job

```typescript
// src/jobs/core/entitySync.job.ts
import cron from 'node-cron';

interface SyncConfig {
  name: string;
  endpoint: string;
  table: string;
  interval: string; // cron expression
}

const SYNC_CONFIGS: SyncConfig[] = [
  { name: 'countries', endpoint: '/country/list', table: 'ts_countries', interval: '0 3 * * *' },
  { name: 'competitions', endpoint: '/competition/list', table: 'ts_competitions', interval: '0 3 * * *' },
  { name: 'teams', endpoint: '/team/list', table: 'ts_teams', interval: '0 4 * * *' },
  { name: 'players', endpoint: '/player/list', table: 'ts_players', interval: '0 5 * * *' },
  { name: 'coaches', endpoint: '/coach/list', table: 'ts_coaches', interval: '0 6 * * *' },
  { name: 'referees', endpoint: '/referee/list', table: 'ts_referees', interval: '0 6 * * *' },
  { name: 'venues', endpoint: '/venue/list', table: 'ts_venues', interval: '0 6 * * *' },
  { name: 'seasons', endpoint: '/season/list', table: 'ts_seasons', interval: '0 3 * * *' },
  { name: 'stages', endpoint: '/stage/list', table: 'ts_stages', interval: '0 3 * * *' },
  { name: 'categories', endpoint: '/category/list', table: 'ts_categories', interval: '0 3 * * *' },
];

export function startEntitySync() {
  for (const config of SYNC_CONFIGS) {
    cron.schedule(config.interval, async () => {
      logger.info(`[EntitySync] Starting ${config.name} sync`);
      await syncEntity(config);
    });
  }
}

async function syncEntity(config: SyncConfig) {
  // Rate limited, paginated sync
  const data = await theSportsClient.get(config.endpoint);
  await upsertToTable(config.table, data);
}
```

### 1.4 SETTLEMENT KONSOLİDASYONU

#### Mevcut Sorun:
Settlement logic 3 farklı yerde dağınık:
1. `dataUpdate.job.ts` - Batch settlement
2. `matchDataSync.job.ts` - Match finish settlement
3. `matchSync.job.ts` - Daily settlement cleanup

#### Çözüm: Unified Settlement Service

```typescript
// src/services/ai/unifiedSettlement.service.ts
export class UnifiedSettlementService {
  // Tek entry point - tüm settlement buradan geçer
  async onMatchUpdate(event: MatchUpdateEvent) {
    const { matchId, statusId, homeScore, awayScore, minute } = event;

    // 1. Status 8 (ENDED) ise final settlement
    if (statusId === 8) {
      await this.settleFinal(matchId, homeScore, awayScore);
      return;
    }

    // 2. Live maç ise real-time check
    if ([2, 3, 4, 5, 7].includes(statusId)) {
      await this.settleLive(matchId, homeScore, awayScore, minute);
    }
  }

  private async settleFinal(matchId: string, home: number, away: number) {
    // Final skor ile tüm tahminleri settle et
    await pool.query(`
      UPDATE ts_prediction_mapped
      SET
        settled = true,
        won = CASE
          WHEN market_type = 'MS1' AND $2 > $3 THEN true
          WHEN market_type = 'MS2' AND $2 < $3 THEN true
          WHEN market_type = 'MSX' AND $2 = $3 THEN true
          WHEN market_type = 'IY1' AND ... THEN true
          ELSE false
        END,
        settled_at = NOW()
      WHERE ts_match_id = $1 AND settled = false
    `, [matchId, home, away]);
  }

  private async settleLive(matchId: string, home: number, away: number, minute: number) {
    // Live tahminler için early settlement (örn: Over 2.5 ve skor 3-0)
    // ...
  }
}
```

### 1.5 MATCHWRITERSERVICE (Single Write Point)

```typescript
// src/services/match/matchWriter.service.ts
export class MatchWriterService {
  // TÜM match database yazımları buradan geçer
  async write(update: MatchUpdate, source: 'mqtt' | 'api' | 'watchdog') {
    const nowTs = Math.floor(Date.now() / 1000);

    const result = await pool.query(`
      UPDATE ts_matches
      SET
        status_id = COALESCE($1, status_id),
        home_score_display = COALESCE($2, home_score_display),
        away_score_display = COALESCE($3, away_score_display),
        minute = COALESCE($4, minute),
        home_scores = COALESCE($5, home_scores),
        away_scores = COALESCE($6, away_scores),
        last_updated_by = $7,
        last_updated_at = $8,
        updated_at = NOW()
      WHERE external_id = $9
        AND (last_updated_at IS NULL OR last_updated_at < $10)
      RETURNING *
    `, [
      update.statusId,
      update.homeScore,
      update.awayScore,
      update.minute,
      update.homeScores,
      update.awayScores,
      source,
      nowTs,
      update.matchId,
      nowTs - 1
    ]);

    if (result.rowCount > 0) {
      // 1. WebSocket broadcast
      websocketService.broadcast({
        type: 'MATCH_UPDATE',
        match: result.rows[0]
      });

      // 2. Settlement trigger
      await settlementService.onMatchUpdate({
        matchId: update.matchId,
        statusId: update.statusId,
        homeScore: update.homeScore,
        awayScore: update.awayScore,
        minute: update.minute
      });

      return result.rows[0];
    }

    return null; // Skip - daha taze veri var
  }
}
```

### 1.6 FAZ 1 CHECKLIST

- [ ] dailyMatchSync.job.ts sil
- [ ] matchFreezeDetection.job.ts sil
- [ ] proactiveMatchStatusCheck.job.ts sil
- [ ] lineupRefresh.job.ts sil
- [ ] postMatchProcessor.job.ts sil
- [ ] 12 entity sync job → entitySync.job.ts birleştir
- [ ] matchWatchdog.job.ts → 2 job'a böl
- [ ] Settlement logic → UnifiedSettlementService
- [ ] MatchWriterService oluştur
- [ ] jobManager.ts güncelle
- [ ] Test ve deploy

---

## FAZ 2: FOOTYSTATS ENTEGRASYONU

### 2.1 Mevcut Varlıklar (commit 481531a):

| Dosya | Durum | Aksiyon |
|-------|-------|---------|
| `src/services/footystats/footystats.client.ts` | ✅ Mevcut | TUTAN - Rate limiter mükemmel |
| `src/services/footystats/mapping.service.ts` | ✅ Mevcut | TUTAN - Mapping logic tam |
| `src/routes/footystats.routes.ts` | ✅ Mevcut | TUTAN - Admin endpoints |
| `integration_mappings` table | 713 kayıt | GENİŞLET |
| `fs_match_stats` table | 0 kayıt | DOLDUR |

### 2.2 Mapping Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   THESPORTS     │     │   MAPPING       │     │   FOOTYSTATS    │
│   Match/Team    │────▶│   SERVICE       │────▶│   Stats         │
│                 │     │                 │     │                 │
│ ts_id: 123456   │     │ ts_id ↔ fs_id   │     │ xG, BTTS, etc   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### 2.3 FootyStats Cron Job

```typescript
// src/jobs/footystats/footystatsSync.job.ts
import cron from 'node-cron';
import { FootyStatsClient } from '../services/footystats/footystats.client';

// Günde 2 kez - sabah ve akşam
cron.schedule('0 6,18 * * *', async () => {
  logger.info('[FootyStats] Starting daily sync');

  // 1. Bugünün maçlarını al
  const todayMatches = await pool.query(`
    SELECT external_id, home_team_id, away_team_id, competition_id
    FROM ts_matches
    WHERE DATE(to_timestamp(match_time)) = CURRENT_DATE
  `);

  // 2. Her maç için FootyStats mapping kontrol et
  for (const match of todayMatches.rows) {
    // Competition mapping var mı?
    const mapping = await pool.query(`
      SELECT fs_id FROM integration_mappings
      WHERE ts_id = $1 AND entity_type = 'competition'
    `, [match.competition_id]);

    if (mapping.rows.length > 0) {
      // FootyStats'tan stats çek
      const stats = await footyStatsClient.getMatchStats(mapping.rows[0].fs_id);
      await saveMatchStats(match.external_id, stats);
    }
  }
});
```

### 2.4 FootyStats Data Schema

```sql
-- fs_match_stats tablosu (mevcut ama boş)
CREATE TABLE IF NOT EXISTS fs_match_stats (
  id SERIAL PRIMARY KEY,
  ts_match_id VARCHAR(100) REFERENCES ts_matches(external_id),

  -- Team Stats
  home_xg DECIMAL(4,2),
  away_xg DECIMAL(4,2),
  home_corners_avg DECIMAL(4,2),
  away_corners_avg DECIMAL(4,2),

  -- Predictions
  btts_percentage INTEGER,  -- Both Teams To Score %
  over_25_percentage INTEGER,
  under_25_percentage INTEGER,

  -- Form
  home_form VARCHAR(10),  -- "WWDLW"
  away_form VARCHAR(10),

  -- Metadata
  fetched_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(ts_match_id)
);

CREATE INDEX idx_fs_stats_match ON fs_match_stats(ts_match_id);
```

### 2.5 FAZ 2 CHECKLIST

- [ ] FootyStats API key doğrula
- [ ] Mevcut 694 league mapping'i kontrol et
- [ ] Eksik league mapping'leri tamamla
- [ ] Team mapping'leri artır (19 → 500+)
- [ ] footystatsSync.job.ts oluştur
- [ ] fs_match_stats tablosunu doldurmaya başla
- [ ] Frontend'e FootyStats widget ekle

---

## FAZ 3: LIVESCORE SAYFASI AKTİVASYONU

### 3.1 Mevcut Varlıklar:

| Dosya | Durum | Aksiyon |
|-------|-------|---------|
| `LivescoreContext.tsx` | ✅ Mükemmel | TUTAN |
| `LivescoreLayout.tsx` | ✅ Mükemmel | TUTAN |
| `tabs/DiaryTab.tsx` | ✅ Mevcut | TUTAN |
| `tabs/LiveTab.tsx` | ✅ Mevcut | TUTAN |
| `tabs/FinishedTab.tsx` | ✅ Mevcut | TUTAN |
| `tabs/NotStartedTab.tsx` | ✅ Mevcut | TUTAN |
| `tabs/AIMatchesTab.tsx` | ✅ Mevcut | TUTAN |
| `tabs/FavoritesTab.tsx` | ✅ Mevcut | TUTAN |
| `AdminLivescore.tsx` | ❌ Eski | SİL |

### 3.2 LivescoreContext Analizi

```typescript
// Mevcut yapı - MÜKEMMEL
export const LivescoreProvider: React.FC = ({ children }) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Initial fetch
  useEffect(() => {
    fetchMatches();
  }, [date]);

  // 2. WebSocket real-time updates
  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'MATCH_UPDATE') {
        // Smart merge - sadece değişeni güncelle
        setMatches(prev => prev.map(m =>
          m.id === data.match.id ? { ...m, ...data.match } : m
        ));
      }
    };
    return () => ws.close();
  }, []);

  return (
    <LivescoreContext.Provider value={{ matches, loading }}>
      {children}
    </LivescoreContext.Provider>
  );
};
```

### 3.3 Routing Güncellemesi

```tsx
// App.tsx - Livescore route'unu aktif et
<Route element={<AdminLayout />}>
  {/* ... diğer route'lar ... */}

  {/* Livescore - YENİ */}
  <Route path="/livescore" element={<LivescoreLayout />}>
    <Route index element={<Navigate to="live" />} />
    <Route path="diary" element={<DiaryTab />} />
    <Route path="live" element={<LiveTab />} />
    <Route path="finished" element={<FinishedTab />} />
    <Route path="not-started" element={<NotStartedTab />} />
    <Route path="ai-matches" element={<AIMatchesTab />} />
    <Route path="favorites" element={<FavoritesTab />} />
  </Route>
</Route>
```

### 3.4 Match Card Design

```
┌─────────────────────────────────────────────────────────────┐
│ 🏆 Süper Lig                                    ⭐ Favori  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🔴 Galatasaray         2 - 1         Fenerbahçe 💛       │
│                                                             │
│  ⏱️ 67'                 🟢 CANLI                           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  📊 Stats  │  💬 Forum (12)  │  🤖 AI  │  📈 xG: 1.8-0.9  │
└─────────────────────────────────────────────────────────────┘
```

### 3.5 FAZ 3 CHECKLIST

- [ ] AdminLivescore.tsx sil (duplicate)
- [ ] LivescoreLayout route'unu aktif et
- [ ] Sidebar'a Livescore linki ekle
- [ ] Match card tasarımını uygula
- [ ] WebSocket bağlantısını test et
- [ ] Mobile responsive kontrol

---

## FAZ 4: FORUM SİSTEMİ AKTİVASYONU

### 4.1 Database Schema (Hazır)

```sql
-- match_comments tablosu MEVCUT
CREATE TABLE match_comments (
  id SERIAL PRIMARY KEY,
  match_id VARCHAR(100) REFERENCES ts_matches(external_id),
  user_id UUID REFERENCES users(id),
  content TEXT NOT NULL,

  -- Yeni eklenen kolonlar
  comment_type VARCHAR(20) DEFAULT 'comment',  -- 'comment' | 'prediction'
  prediction_market VARCHAR(50),  -- 'MS1', 'Over 2.5', etc.
  prediction_result VARCHAR(20),  -- 'pending' | 'won' | 'lost'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comments_match ON match_comments(match_id);
CREATE INDEX idx_comments_user ON match_comments(user_id);
```

### 4.2 Forum API Endpoints

```typescript
// src/routes/forum.routes.ts
router.get('/matches/:matchId/comments', getMatchComments);
router.post('/matches/:matchId/comments', createComment);
router.post('/matches/:matchId/predictions', createUserPrediction);
router.delete('/comments/:commentId', deleteComment);

// Response format
interface Comment {
  id: number;
  matchId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  content: string;
  commentType: 'comment' | 'prediction';
  predictionMarket?: string;
  predictionResult?: 'pending' | 'won' | 'lost';
  createdAt: string;
  likes: number;
  isLikedByMe: boolean;
}
```

### 4.3 Forum Component

```tsx
// frontend/src/components/forum/MatchForum.tsx
export const MatchForum: React.FC<{ matchId: string }> = ({ matchId }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');

  return (
    <div className="match-forum">
      {/* Comment List */}
      <div className="comments-list">
        {comments.map(comment => (
          <CommentCard key={comment.id} comment={comment} />
        ))}
      </div>

      {/* New Comment Form */}
      <div className="new-comment">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Yorumunuzu yazın..."
        />
        <button onClick={handleSubmit}>Gönder</button>
      </div>

      {/* Quick Prediction Buttons */}
      <div className="quick-predictions">
        <button onClick={() => handlePrediction('MS1')}>Ev Sahibi Kazanır</button>
        <button onClick={() => handlePrediction('MSX')}>Beraberlik</button>
        <button onClick={() => handlePrediction('MS2')}>Deplasman Kazanır</button>
      </div>
    </div>
  );
};
```

### 4.4 FAZ 4 CHECKLIST

- [ ] forum.routes.ts oluştur
- [ ] Forum controller ve service oluştur
- [ ] MatchForum component oluştur
- [ ] CommentCard component oluştur
- [ ] Match card'a forum badge ekle
- [ ] Real-time comment updates (WebSocket)
- [ ] Kullanıcı tahmin sistemi

---

## FAZ 5: MOBİL UYGULAMA HAZIRLIĞI (Opsiyonel)

### 5.1 API Standardizasyonu

Tüm API endpoint'leri mobile-ready olmalı:
- Pagination standardı
- Error response formatı
- Rate limiting
- Authentication token refresh

### 5.2 Push Notification Infrastructure

```typescript
// Notification triggers
- Gol atıldığında (takip edilen maç)
- Maç başladığında (takip edilen maç)
- Maç bittiğinde (takip edilen maç)
- AI tahmin geldiğinde (premium users)
- Tahmin sonuçlandığında (won/lost)
```

---

## UYGULAMA TAKVİMİ

```
┌─────────────────────────────────────────────────────────────┐
│                    IMPLEMENTATION ROADMAP                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  FAZ 1: BACKEND TEMİZLİĞİ                                  │
│  ├── Job konsolidasyonu                                    │
│  ├── Settlement birleştirme                                │
│  └── MatchWriterService                                    │
│                                                             │
│  FAZ 2: FOOTYSTATS                                         │
│  ├── Mapping tamamlama                                     │
│  └── Stats sync job                                        │
│                                                             │
│  FAZ 3: LIVESCORE                                          │
│  ├── Route aktivasyonu                                     │
│  └── UI polish                                             │
│                                                             │
│  FAZ 4: FORUM                                              │
│  ├── API endpoints                                         │
│  └── Frontend components                                   │
│                                                             │
│  FAZ 5: MOBILE (Opsiyonel)                                 │
│  ├── API standardizasyon                                   │
│  └── Push notifications                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## KRİTİK VARLIKLAR - DOKUNMA!

Bu dosyalar kritik ve çalışıyor, değiştirme:

1. **TeamNameMatcherService** (`src/services/ai/teamNameMatcher.service.ts`)
   - Fuzzy matching için kritik
   - Levenshtein distance, word similarity
   - ts_team_aliases lookup

2. **AIPredictionsContext** (`frontend/src/context/AIPredictionsContext.tsx`)
   - AI tahmin state management
   - Çalışıyor, bozma

3. **LivescoreContext** (`frontend/src/components/livescore/LivescoreContext.tsx`)
   - Mükemmel API + WebSocket merge
   - Production-ready

4. **FootyStats Client** (`src/services/footystats/footystats.client.ts`)
   - Rate limiter mükemmel
   - Token bucket algorithm

---

## BAŞARI METRİKLERİ

### Performance:
- ✅ Score update latency: <200ms
- ✅ Page load time: <2s
- ✅ API response time: <500ms

### Code Quality:
- ✅ Jobs: 34 → 15 (56% azalma)
- ✅ Settlement logic: 3 → 1 (unified)
- ✅ Code duplication: -40%

### Features:
- ✅ Livescore aktif
- ✅ FootyStats entegre
- ✅ Forum çalışıyor
- ✅ AI predictions stabil

---

**Son Güncelleme:** 18 Ocak 2026
**Hazırlayan:** Senior Backend Architect
**Durum:** FAZ 1 BAŞLIYOR

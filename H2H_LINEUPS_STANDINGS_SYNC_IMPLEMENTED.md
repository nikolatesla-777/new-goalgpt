# H2H, Lineups, Standings Pre-Sync Implementation

**Date:** 2025-12-27  
**Status:** ✅ IMPLEMENTED

---

## Problem

H2H, Puan Durumu ve Kadro verileri 00:05'te yeni bülteni çekerken başlamamış maçlar için database'e yazılmıyordu. İş planı vardı ama implement edilmemişti.

---

## Solution

`DailyMatchSyncWorker.syncDateDiary()` fonksiyonuna, match sync tamamlandıktan sonra **NOT_STARTED (status_id = 1)** maçlar için H2H, Lineups ve Standings pre-sync'i eklendi.

---

## Implementation Details

### 1. Pre-Sync Service

`DailyPreSyncService` zaten mevcut ve şunları yapıyor:

- **H2H:** `/match/analysis` endpoint'i ile `MatchAnalysisService` kullanarak H2H verisi çekiliyor
- **Lineups:** `/match/lineup/detail` endpoint'i ile `MatchLineupService` kullanarak kadro verisi çekiliyor
- **Standings:** `/season/recent/table/detail` endpoint'i ile `SeasonStandingsService` kullanarak puan durumu çekiliyor

### 2. Integration Point

**File:** `src/jobs/dailyMatchSync.job.ts`

**Location:** `syncDateDiary()` fonksiyonu, match sync tamamlandıktan sonra (line 388-412 arası)

**Logic:**
```typescript
// After match sync completes successfully
// 1. Query database for NOT_STARTED matches (status_id = 1) for the synced date
// 2. Extract match_ids and unique season_ids
// 3. Call DailyPreSyncService.runPreSync(matchIds, seasonIds)
// 4. Log results (H2H synced, Lineups synced, Standings synced)
```

### 3. Endpoints Used

- ✅ `/match/analysis` → H2H data (historical confrontation, recent results, goal distribution)
- ✅ `/match/lineup/detail` → Lineup data (formations, starting XI, substitutes)
- ✅ `/season/recent/table/detail` → Standings data (league table)

---

## Workflow

```
00:05 → DailyMatchSyncWorker.syncTodayDiary() triggered
  ↓
syncDateDiary() called
  ↓
1. Fetch /match/diary?date=YYYYMMDD
  ↓
2. Sync matches to database (all statuses)
  ↓
3. Query database: SELECT external_id, season_id FROM ts_matches 
   WHERE match_time >= date_start AND match_time < date_end 
   AND status_id = 1 (NOT_STARTED)
  ↓
4. DailyPreSyncService.runPreSync(matchIds, seasonIds)
  ↓
  4.1. For each match_id:
      - syncH2HToDb() → /match/analysis → ts_match_h2h table
      - syncLineupToDb() → /match/lineup/detail → ts_match_lineups table
  ↓
  4.2. For each unique season_id:
      - syncStandingsToDb() → /season/recent/table/detail → ts_standings table
  ↓
5. Log results:
   ✅ Pre-sync complete: H2H=X, Lineups=Y, Standings=Z
```

---

## Database Tables

1. **`ts_match_h2h`** - H2H data
   - Columns: `match_id`, `total_matches`, `home_wins`, `draws`, `away_wins`, `h2h_matches`, `home_recent_form`, `away_recent_form`, `goal_distribution`, `raw_response`

2. **`ts_match_lineups`** - Lineup data
   - Columns: `match_id`, `home_formation`, `away_formation`, `home_lineup`, `away_lineup`, `home_subs`, `away_subs`, `raw_response`

3. **`ts_standings`** - Standings data
   - Columns: `season_id`, `standings`, `raw_response`

---

## API Endpoints

### `/match/analysis`
- **Description:** H2H. Return to match analysis statistics (historical confrontation/recent results, future matches, goal distribution)
- **Used by:** `MatchAnalysisService.getMatchAnalysis()`
- **Rate Limit:** 60 requests/minute
- **Cache:** 1 hour

### `/match/lineup/detail`
- **Description:** Match lineup details (formations, starting XI, substitutes)
- **Used by:** `MatchLineupService.getMatchLineup()`

### `/season/recent/table/detail`
- **Description:** Season standings/table
- **Used by:** `SeasonStandingsService.getSeasonStandings()`

---

## Result

✅ **H2H, Lineups, Standings artık 00:05'te otomatik sync ediliyor**

Her gün 00:05'te:
1. Yeni günün maçları sync ediliyor
2. Başlamamış maçlar (status_id = 1) için H2H verisi çekilip database'e yazılıyor
3. Başlamamış maçlar için kadro verisi çekilip database'e yazılıyor
4. Her lig için puan durumu çekilip database'e yazılıyor

Frontend'te `/api/matches/:match_id/h2h` endpoint'i database'den okuyor, eğer yoksa API'den çekiyor.

---

## Files Changed

1. `src/jobs/dailyMatchSync.job.ts` - Added pre-sync logic after match sync
2. `src/services/thesports/sync/dailyPreSync.service.ts` - Already existed (no changes)
3. `src/services/thesports/match/matchAnalysis.service.ts` - Already existed (uses `/match/analysis`)



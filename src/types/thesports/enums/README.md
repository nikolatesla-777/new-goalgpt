# TheSports API Enums

**FAZ 1.2: ✅ COMPLETED**

## 📁 Oluşturulan Enum'lar

### 1. `MatchState.enum.ts` ✅
- Match state definitions (0-13)
- Helper functions: `isLiveMatchState()`, `isFinishedMatchState()`
- States: ABNORMAL, NOT_STARTED, FIRST_HALF, HALF_TIME, SECOND_HALF, etc.

### 2. `TechnicalStatistics.enum.ts` ✅
- Technical statistics definitions (1-37)
- Helper functions: `isGoalStatistic()`, `isCardStatistic()`
- Stats: GOAL, CORNER, YELLOW_CARD, RED_CARD, SUBSTITUTION, VAR, etc.

### 3. `EventReason.enum.ts` ✅
- Event reason definitions (0-37)
- Reasons: FOUL, PROFESSIONAL_FOUL, TACTICAL, VIOLENT_CONDUCT, etc.

### 4. `HalfTimeStatistics.enum.ts` ✅
- Half-time statistics definitions (1-83)
- Stats: GOAL, CORNER, SHOTS_ON_TARGET, BALL_POSSESSION, PASS, etc.

### 5. `VARReason.enum.ts` ✅
- VAR reason definitions
- Reasons: GOAL_AWARDED, PENALTY_AWARDED, RED_CARD_GIVEN, etc.

### 6. `VARResult.enum.ts` ✅
- VAR result definitions
- Results: GOAL_CONFIRMED, GOAL_CANCELLED, PENALTY_CONFIRMED, etc.

### 7. `DataUpdateType.enum.ts` ✅
- Data update type definitions
- Types: SINGLE_MATCH_LINEUP, SEASON_STANDING, MATCH_INCIDENT_GIF, etc.

### 8. `index.ts` ✅
- Central export for all enums

## 🎯 Kullanım

```typescript
import { MatchState, TechnicalStatistics, EventReason } from '../types/thesports/enums';

// Match state check
if (match.status === MatchState.FIRST_HALF) {
  // First half logic
}

// Technical statistics
if (isGoalStatistic(TechnicalStatistics.GOAL)) {
  // Goal event
}

// Event reason
if (event.reason === EventReason.PROFESSIONAL_FOUL) {
  // Professional foul
}
```

## ✅ Features

- ✅ Type-safe enum definitions
- ✅ Helper functions for common checks
- ✅ Centralized exports
- ✅ Full documentation

## 📋 Next Steps

- FAZ 1.3: Match Recent Service (Response types + Service implementation)


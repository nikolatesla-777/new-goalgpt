### 1. `src/services/thesports/match/matchSync.service.ts`

**Değişiklikler:**
- ✅ Validation gevşetildi (sadece `external_id` ve `match_time` zorunlu)
- ✅ Error logging detaylandırıldı
- ✅ JSONB array serialization kalıcı çözümü (JSON.stringify + ::jsonb cast)
- ✅ Rejection reason tracking eklendi

**Kritik Kod Değişiklikleri:**

```typescript
// Validation
async syncMatch(matchData: MatchSyncData, ...): Promise<void> {
  if (!matchData.external_id) {
    throw new Error('REJECTED: missing external_id (required)');
  }
  if (matchData.match_time == null || matchData.match_time === 0) {
    throw new Error('REJECTED: missing match_time (required)');
  }
  // ... rest of code
}

// JSONB Arrays (kalıcı çözüm)
const toJsonb = (v: unknown): string | null => {
  if (v == null) return null;
  try { return JSON.stringify(v); } catch { return null; }
};

columns.push('home_scores', 'away_scores');
values.push(toJsonb(matchData.home_scores), toJsonb(matchData.away_scores));
// SQL tarafında $X::jsonb cast kullanılmalı
```

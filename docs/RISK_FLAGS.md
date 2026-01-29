# Risk Flags Reference

**Version:** 1.0.0
**Date:** 2026-01-28

For technical implementation, see: `/src/services/scoring/riskFlags.ts`

---

## Risk Flag Categories

### 🔴 BLOCKING FLAGS (Prevent Publish)
- `MISSING_XG` - Critical data missing
- `MISSING_POTENTIAL_HT` - HT_O05 cannot proceed
- `MISSING_POTENTIAL_CORNERS` - CORNERS_O85 blocked
- `MISSING_POTENTIAL_CARDS` - CARDS_O25 blocked
- `LOW_TIER_LEAGUE` - Poor data quality
- `CONFLICT_SIGNALS` - Components strongly disagree

### 🟡 WARNING FLAGS (Publish Allowed, User Aware)
- `MISSING_ODDS` - Edge calculation skipped
- `NO_REFEREE_DATA` - Known limitation
- `HIGH_VARIANCE` - Components disagree moderately
- `LOW_SAMPLE_LEAGUE` - Limited historical data

### 🔵 INFO FLAGS (Minimal Impact)
- `MISSING_H2H` - Optional data
- `MISSING_TRENDS` - Optional data
- `CORNERS_DATA_UNAVAILABLE` - Settlement may VOID
- `CARDS_DATA_UNAVAILABLE` - Settlement may VOID

---

## Confidence Penalty Table

| Flag | Penalty | Severity |
|------|---------|----------|
| MISSING_XG | -20 | BLOCKING |
| MISSING_POTENTIAL_CORNERS | -20 | BLOCKING |
| MISSING_POTENTIAL_CARDS | -20 | BLOCKING |
| MISSING_POTENTIAL_HT | -20 | BLOCKING |
| MISSING_POTENTIALS | -15 | BLOCKING |
| CONFLICT_SIGNALS | -15 | BLOCKING |
| LOW_TIER_LEAGUE | -12 | BLOCKING |
| HIGH_VARIANCE | -12 | WARNING |
| NO_REFEREE_DATA | -10 | WARNING |
| EXTREME_ODDS | -10 | WARNING |
| LOW_SAMPLE_LEAGUE | -8 | WARNING |
| MISSING_ODDS | -5 | INFO |
| MISSING_TRENDS | -5 | INFO |
| MISSING_H2H | -3 | INFO |

---

**Last Updated:** 2026-01-28

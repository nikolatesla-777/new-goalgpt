# Team Last X Stats

Get recent form stats (Last 5, 6, or 10 matches) for a team.

## Endpoint
```
GET https://api.football-data-api.com/lastx?key=YOURKEY&team_id=X
```

## Sample Request
```
https://api.football-data-api.com/lastx?key=example&team_id=59
```

## Query Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `key` | string | ✅ | Your API Key |
| `team_id` | integer | ✅ | Team ID |

## Response Structure
Returns 3 entries per team (Last 5, Last 6, Last 10):
- `last_x_match_num: 5` - Last 5 matches
- `last_x_match_num: 6` - Last 6 matches  
- `last_x_match_num: 10` - Last 10 matches

## 🔥 AI Critical: Form Fields

| Field | Example | Description |
|-------|---------|-------------|
| `formRun_overall` | `"wwdww"` | **Form string (W/D/L)** |
| `formRun_home` | `"www"` | Home form |
| `formRun_away` | `"dw"` | Away form |
| `seasonPPG_overall` | `2.6` | PPG in last X |
| `winPercentage_overall` | `80` | Win % |
| `seasonBTTSPercentage_overall` | `20` | BTTS % |
| `seasonOver25Percentage_overall` | `40` | Over 2.5 % |

## Key Stats (Same as Team endpoint)

### Betting Stats
| Field | Description |
|-------|-------------|
| `seasonBTTSPercentage_overall/home/away` | BTTS % |
| `seasonOver25Percentage_overall` | Over 2.5 % |
| `seasonCSPercentage_overall` | Clean Sheet % |
| `xg_for_avg_overall` | xG per match |

### Goal Timing
| Field | Description |
|-------|-------------|
| `goals_scored_min_0_to_10` - `81_to_90` | Goals by period |
| `goals_conceded_min_0_to_10` - `81_to_90` | Conceded by period |

### Corners & Cards
| Field | Description |
|-------|-------------|
| `cornersAVG_overall` | Corners per match |
| `cardsAVG_overall` | Cards per match |
| `over95CornersPercentage_overall` | Over 9.5 corners % |

## Notes
- 🔥 **formRun field is CRITICAL for AI** - Shows exact W/D/L sequence
- One API call returns all 3 datasets (5/6/10)
- Perfect for "current form" analysis
- `last_x_home_away_or_overall: "0"` = all matches combined
- Stats structure identical to `/team` endpoint
- Last 15 and Last 20 coming soon

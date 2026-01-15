# League Teams

Get all teams in a league season with comprehensive statistics.

## Endpoint
```
GET https://api.football-data-api.com/league-teams?key=YOURKEY&season_id=X&include=stats
```

## Sample Request
```
https://api.football-data-api.com/league-teams?key=example&season_id=2012&include=stats
```

## Query Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `key` | string | ✅ | Your API Key |
| `season_id` | integer | ✅ | Season ID |
| `include` | string | ❌ | Add `stats` to get team statistics |
| `page` | integer | ❌ | Pagination (50 teams/page) |
| `max_time` | integer | ❌ | UNIX timestamp for historical |

## Response (Sample)

```json
{
    "success": true,
    "data": [
        {
            "id": 59,
            "name": "Arsenal FC",
            "cleanName": "Arsenal",
            "country": "England",
            "table_position": 5,
            "competition_id": 1625,
            "stats": {
                "seasonBTTSPercentage_overall": 61,
                "seasonOver25Percentage_overall": 55,
                "seasonPPG_overall": 1.47,
                "cornersAVG_overall": 6.08,
                "xg_for_avg_overall": 1.43
            }
        }
    ]
}
```

## Team Info Fields
| Field | Description |
|-------|-------------|
| `id` | Team ID |
| `name` / `cleanName` | Team name |
| `country` | Country |
| `table_position` | League position |
| `competition_id` | Season ID |
| `name_tr` | Turkish name 🇹🇷 |

## 🎯 CRITICAL STATS FOR AI

### Goals & Scoring
| Field | Description |
|-------|-------------|
| `seasonPPG_overall/home/away` | **Points per game** |
| `seasonScoredAVG_overall` | Goals scored per match |
| `seasonConcededAVG_overall` | Goals conceded per match |
| `seasonAVG_overall` | Total goals per match |

### 🎯 BTTS Stats
| Field | Description |
|-------|-------------|
| `seasonBTTSPercentage_overall` | **BTTS %** |
| `seasonBTTSPercentage_home` | BTTS % at home |
| `seasonBTTSPercentage_away` | BTTS % away |

### 🎯 Over/Under Stats
| Field | Description |
|-------|-------------|
| `seasonOver05Percentage_overall` - `seasonOver55Percentage_overall` | Over X goals % |
| `seasonUnder05Percentage_overall` - `seasonUnder55Percentage_overall` | Under X goals % |

### 🎯 Corner Stats
| Field | Description |
|-------|-------------|
| `cornersAVG_overall` | Corners per match |
| `over65CornersPercentage_overall` - `over145CornersPercentage_overall` | Over X corners % |

### 🎯 Card Stats
| Field | Description |
|-------|-------------|
| `cardsAVG_overall` | Cards per match |
| `over25CardsPercentage_overall` - `over75CardsPercentage_overall` | Over X cards % |

### 🎯 xG (Expected Goals)
| Field | Description |
|-------|-------------|
| `xg_for_avg_overall` | xG for (per match) |
| `xg_against_avg_overall` | xG against (per match) |

### Goal Timing
| Field | Description |
|-------|-------------|
| `goals_scored_min_0_to_10` - `goals_scored_min_81_to_90` | Goals by time period |
| `goals_conceded_min_0_to_10` - `goals_conceded_min_81_to_90` | Conceded by time period |

### Clean Sheet / Failed to Score
| Field | Description |
|-------|-------------|
| `seasonCSPercentage_overall` | Clean sheet % |
| `seasonFTSPercentage_overall` | Failed to score % |

## Notes
- 🔥 **En kapsamlı takım istatistikleri bu endpoint'te!**
- `include=stats` mutlaka ekle, yoksa sadece temel bilgi gelir
- Her stat için `_overall`, `_home`, `_away` varyantları var
- AI modeli için: BTTS%, Over%, xG, PPG, Corners AVG kritik

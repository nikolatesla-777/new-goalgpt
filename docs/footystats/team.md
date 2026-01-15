# Team (Individual)

Get comprehensive stats for a single team across all their seasons.

## Endpoint
```
GET https://api.football-data-api.com/team?key=YOURKEY&team_id=X&include=stats
```

## Sample Request
```
https://api.football-data-api.com/team?key=example&team_id=59&include=stats
```

## Query Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `key` | string | ✅ | Your API Key |
| `team_id` | integer | ✅ | Team ID |
| `include` | string | ❌ | Add `stats` for full statistics |

## Response (Sample)

```json
{
    "success": true,
    "data": [
        {
            "id": 59,
            "name": "Arsenal",
            "full_name": "Arsenal FC",
            "country": "England",
            "founded": "1886",
            "stadium_name": "Emirates Stadium",
            "competition_id": 11042,
            "stats": {
                "seasonBTTSPercentage_overall": 61,
                "seasonOver25Percentage_overall": 55,
                "xg_for_avg_overall": 1.43
            }
        }
    ]
}
```

## Team Info
| Field | Description |
|-------|-------------|
| `id` | Team ID |
| `name` / `full_name` | Team names |
| `country` | Country |
| `founded` | Foundation year |
| `stadium_name` / `stadium_address` | Stadium info |
| `name_tr` | Turkish name 🇹🇷 |
| `alt_names` | Alternative names array |

## Stats Object
Same comprehensive stats as `/league-teams` endpoint:

### 🎯 AI Critical Stats
| Field | Description |
|-------|-------------|
| `seasonBTTSPercentage_overall` | BTTS % |
| `seasonOver25Percentage_overall` | Over 2.5 % |
| `seasonPPG_overall` | Points per game |
| `cornersAVG_overall` | Corners per match |
| `xg_for_avg_overall` | xG scored |
| `xg_against_avg_overall` | xG conceded |

### Goal Timing
| Field | Description |
|-------|-------------|
| `goals_scored_min_0_to_10` - `goals_scored_min_81_to_90` | Goals by 10-min period |
| `goals_conceded_min_0_to_10` - `goals_conceded_min_81_to_90` | Conceded by period |

### Special Stats
| Field | Description |
|-------|-------------|
| `prediction_risk` | How often team scores/concedes in close succession |
| `homeAttackAdvantage` | Home attack advantage % |
| `homeDefenceAdvantage` | Home defence advantage % |

## Notes
- Returns **multiple seasons** for the team (array of season entries)
- `include=stats` required for full statistics
- Same stat structure as league-teams but single team focused
- Useful for historical team analysis across seasons

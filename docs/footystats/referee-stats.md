# Referee Individual Stats

Get comprehensive stats for a single referee across all seasons/competitions.

## Endpoint
```
GET https://api.football-data-api.com/referee?key=YOURKEY&referee_id=X
```

## Query Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `key` | string | ✅ | Your API Key |
| `referee_id` | integer | ✅ | Referee ID |

## Response (Sample)

```json
{
    "success": true,
    "data": [{
        "id": 393,
        "full_name": "Michael Oliver",
        "nationality": "England",
        "league": "UEFA Nations League",
        "season": "2020/2021",
        "appearances_overall": 2,
        "btts_percentage": 50,
        "goals_per_match_overall": 1,
        "penalties_given_per_match_overall": 0
    }]
}
```

## Referee Info
| Field | Description |
|-------|-------------|
| `id` | Referee ID |
| `full_name` | Full name |
| `nationality` | Country |
| `age` | Current age |
| `birthday` | UNIX timestamp |

## Match Stats
| Field | Description |
|-------|-------------|
| `appearances_overall` | Matches officiated |
| `wins_home` | Home team wins |
| `wins_away` | Away team wins |
| `draws_overall` | Draws |
| `wins_per_home` | Home win % |
| `wins_per_away` | Away win % |
| `draws_per` | Draw % |

## 🎯 Betting-Critical Stats
| Field | Description |
|-------|-------------|
| `btts_overall` | BTTS count |
| `btts_percentage` | **BTTS %** |
| `goals_overall` | Total goals |
| `goals_per_match_overall` | **Avg goals/match** |
| `penalties_given_overall` | Penalties awarded |
| `penalties_given_per_match_overall` | **Penalties/match** |
| `penalties_given_percentage_overall` | Penalty match % |

## Notes
- Returns **array of seasons** - stats per competition/season
- 🔥 BTTS % critical for BTTS predictions
- 🔥 Penalties/match critical for penalty market
- Combine with league-referees for full picture

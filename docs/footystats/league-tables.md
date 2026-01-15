# League Tables

Get league standings/tables for a season.

## Endpoint
```
GET https://api.football-data-api.com/league-tables?key=YOURKEY&season_id=X
```

## Sample Request
```
https://api.football-data-api.com/league-tables?key=example&season_id=2012
```

## Query Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `key` | string | ✅ | Your API Key |
| `season_id` | integer | ✅ | Season ID |
| `max_time` | integer | ❌ | UNIX timestamp for historical |

## Response Structure

### Table Types
| Field | Description |
|-------|-------------|
| `league_table` | Main table (NULL for cups) |
| `all_matches_table_overall` | Table across ALL matches |
| `all_matches_table_home` | Home-only table |
| `all_matches_table_away` | Away-only table |
| `specific_tables` | Tables per round/group |

### Team Entry
```json
{
    "id": "76",
    "name": "Villarreal CF",
    "position": 1,
    "points": 11,
    "matchesPlayed": 6,
    "seasonWins_overall": 3,
    "seasonDraws_overall": 2,
    "seasonLosses_overall": 1,
    "seasonGoals": 10,
    "seasonConceded": 6,
    "seasonGoalDifference": 4,
    "wdl_record": "wddwwl"
}
```

### Specific Tables (Cups/Groups)
```json
"specific_tables": [
    {
        "round": "Group Stage",
        "groups": [
            {
                "name": "Group A",
                "table": [/* team entries */]
            }
        ]
    }
]
```

## Table Fields

| Field | Description |
|-------|-------------|
| `id` | Team ID |
| `name` | Team name |
| `position` | Table position |
| `points` | Total points |
| `matchesPlayed` | Matches played |
| `seasonWins_overall/home/away` | Wins |
| `seasonDraws_overall/home/away` | Draws |
| `seasonLosses_overall/home/away` | Losses |
| `seasonGoals` | Goals scored |
| `seasonConceded` | Goals conceded |
| `seasonGoalDifference` | Goal difference |
| `wdl_record` | Form string (e.g., "wddwwl") |
| `zone` | Promotion/relegation zone |
| `corrections` | Point deductions |

## Supported Formats
- **Standard Leagues**: Premier League, La Liga, etc.
- **Groups**: Champions League groups
- **Multi-round**: Apertura/Clausura (South America)
- **Playoffs**: Returns NULL for knockout stages

## Notes
- Use `max_time` for historical standings
- `all_matches_table_*` useful for calculating overall form
- `wdl_record` shows recent form (W/D/L sequence)

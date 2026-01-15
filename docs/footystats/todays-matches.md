# Today's Matches (Matches by Day)

Get a list of matches for today or any specific date.

## Endpoint
```
GET https://api.football-data-api.com/todays-matches?key=YOURKEY
```

## Sample Request
```
https://api.football-data-api.com/todays-matches?key=example
```

## Query Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `key` | string | ✅ | Your API Key |
| `date` | string | ❌ | Date format: YYYY-MM-DD (default: today UTC) |
| `timezone` | string | ❌ | TZ name, e.g. `Europe/Istanbul` (default: Etc/UTC) |

## Pagination
- Max 200 matches per page
- Add `&page=2` for next page

## Response

```json
{
    "success": true,
    "pager": {
        "current_page": 1,
        "max_page": 1,
        "results_per_page": 200,
        "total_results": 2
    },
    "data": [
        {
            "id": 579362,
            "homeID": 155,
            "awayID": 93,
            "season": "2019/2020",
            "status": "incomplete",
            "roundID": 50055,
            "game_week": 37,
            "homeGoalCount": 0,
            "awayGoalCount": 0,
            "totalGoalCount": 0,
            "team_a_corners": -1,
            "team_b_corners": -1,
            "team_a_possession": -1,
            "team_b_possession": -1,
            "odds_ft_1": 8.75,
            "odds_ft_x": 5.8,
            "odds_ft_2": 1.33
        }
    ]
}
```

## Response Fields

### Match Info
| Field | Description |
|-------|-------------|
| `id` | Match ID |
| `homeID` | Home team ID |
| `awayID` | Away team ID |
| `season` | Season year (e.g. "2019/2020") |
| `status` | Match status: `incomplete`, `complete` |
| `game_week` | Game week number |

### Goals
| Field | Description |
|-------|-------------|
| `homeGoals` | Goal timings array for Home |
| `awayGoals` | Goal timings array for Away |
| `homeGoalCount` | Home team goals |
| `awayGoalCount` | Away team goals |
| `totalGoalCount` | Total goals in match |

### Match Stats (-1 = not available)
| Field | Description |
|-------|-------------|
| `team_a_corners` | Home corners |
| `team_b_corners` | Away corners |
| `team_a_shots` | Home total shots (-2 default) |
| `team_b_shots` | Away total shots |
| `team_a_shotsOnTarget` | Home shots on target |
| `team_b_shotsOnTarget` | Away shots on target |
| `team_a_possession` | Home possession % |
| `team_b_possession` | Away possession % |
| `team_a_fouls` | Home fouls |
| `team_b_fouls` | Away fouls |
| `team_a_offsides` | Home offsides |
| `team_b_offsides` | Away offsides |

### Cards
| Field | Description |
|-------|-------------|
| `team_a_yellow_cards` | Home yellow cards |
| `team_b_yellow_cards` | Away yellow cards |
| `team_a_red_cards` | Home red cards |
| `team_b_red_cards` | Away red cards |

### Odds 🎯
| Field | Description |
|-------|-------------|
| `odds_ft_1` | Home win odds |
| `odds_ft_x` | Draw odds |
| `odds_ft_2` | Away win odds |

### Other
| Field | Description |
|-------|-------------|
| `refereeID` | Referee ID |
| `coach_a_ID` | Home coach ID |
| `coach_b_ID` | Away coach ID |
| `stadium_name` | Stadium name |
| `stadium_location` | Stadium location |

## Notes
- ⚠️ Must select leagues in account settings first
- `-1` or `-2` means data not available yet

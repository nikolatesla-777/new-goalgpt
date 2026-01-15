# Player Individual Stats

Get comprehensive stats for a single player across all seasons/leagues.

## Endpoint
```
GET https://api.football-data-api.com/player-stats?key=YOURKEY&player_id=X
```

## Query Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `key` | string | ✅ | Your API Key |
| `player_id` | integer | ✅ | Player ID (from league-players) |

## Response (Sample)

```json
{
    "success": true,
    "data": [{
        "id": "3171",
        "full_name": "Cristiano Ronaldo dos Santos Aveiro",
        "known_as": "Cristiano Ronaldo",
        "position": "Forward",
        "nationality": "Portugal",
        "club_team_id": "84",
        "goals_overall": 12,
        "assists_overall": 5,
        "xg_per_90_overall": 0.65
    }]
}
```

## Player Info
| Field | Description |
|-------|-------------|
| `id` | Player ID |
| `full_name` / `known_as` | Names |
| `position` | Playing position |
| `nationality` | Country |
| `age` | Current age |
| `club_team_id` | Current club ID |

## Basic Stats
| Field | Description |
|-------|-------------|
| `appearances_overall/home/away` | Matches played |
| `minutes_played_overall` | Total minutes |
| `goals_overall/home/away` | Goals scored |
| `assists_overall/home/away` | Assists |
| `goals_per_90_overall` | Goals per 90 min |
| `assists_per_90_overall` | Assists per 90 min |
| `goals_involved_per_90_overall` | G+A per 90 min |

## 🎯 Advanced Stats (detailed object)

### Expected Goals
| Field | Description |
|-------|-------------|
| `xg_per_90_overall` | xG per 90 |
| `xg_total_overall` | Total xG |
| `npxg_per_90_overall` | Non-penalty xG |
| `xa_per_90_overall` | xA per 90 |

### Shooting
| Field | Description |
|-------|-------------|
| `shots_per_90_overall` | Shots per 90 |
| `shots_on_target_per_90_overall` | SOT per 90 |
| `shot_conversion_rate_overall` | Goal/shot % |
| `shot_accuraccy_percentage_overall` | Shot accuracy % |

### Passing
| Field | Description |
|-------|-------------|
| `passes_per_90_overall` | Passes per 90 |
| `pass_completion_rate_overall` | Pass accuracy % |
| `key_passes_per_90_overall` | Key passes per 90 |
| `crosses_per_90_overall` | Crosses per 90 |

### Defensive
| Field | Description |
|-------|-------------|
| `tackles_per_90_overall` | Tackles per 90 |
| `interceptions_per_90_overall` | Interceptions per 90 |
| `clearances_per_90_overall` | Clearances per 90 |
| `blocks_per_90_overall` | Blocks per 90 |

### Goalkeeper
| Field | Description |
|-------|-------------|
| `saves_per_90_overall` | Saves per 90 |
| `save_percentage_overall` | Save % |
| `conceded_per_90_overall` | Goals conceded per 90 |
| `pens_saved_total_overall` | Penalties saved |

### Cards & Fouls
| Field | Description |
|-------|-------------|
| `yellow_cards_overall` | Yellow cards |
| `red_cards_overall` | Red cards |
| `cards_per_90_overall` | Cards per 90 |
| `fouls_committed_per_90_overall` | Fouls per 90 |

### Percentile Rankings
Most stats have a `*_percentile_overall` variant showing ranking vs peers:
- `goals_per90_percentile_overall`
- `xg_per90_percentile_overall`
- `tackles_per90_percentile_overall`
- etc.

## Notes
- Returns **array of seasons** - player stats per league/season
- `detailed` object contains advanced metrics
- Percentile fields compare player to all others in league
- `club_team_2_id` shows loan/transfer destination
- `annual_salary_eur` available for some players

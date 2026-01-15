# League Matches

Get all matches for a league season with full stats and pre-match predictions.

## Endpoint
```
GET https://api.football-data-api.com/league-matches?key=YOURKEY&season_id=X
```

## Sample Request
```
https://api.football-data-api.com/league-matches?key=example&season_id=2012
```

## Query Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `key` | string | ✅ | Your API Key |
| `season_id` | integer | ✅ | Season ID from league-list |
| `page` | integer | ❌ | Pagination (default: 1) |
| `max_per_page` | integer | ❌ | Results per page (max: 1000) |
| `max_time` | integer | ❌ | UNIX timestamp for historical data |

## Response (Sample)

```json
{
    "success": true,
    "data": [
        {
            "id": 49347,
            "homeID": 1002,
            "awayID": 1003,
            "status": "complete",
            "homeGoalCount": 3,
            "awayGoalCount": 2,
            "totalGoalCount": 5,
            "team_a_corners": 3,
            "team_b_corners": 5,
            "team_a_possession": 34,
            "team_b_possession": 66,
            "odds_ft_1": 3.63,
            "odds_ft_x": 3.52,
            "odds_ft_2": 2.15,
            "btts_potential": 72,
            "avg_potential": 2.8,
            "btts": true,
            "over25": true,
            "date_unix": 1487993400
        }
    ]
}
```

## Response Fields

### Match Info
| Field | Description |
|-------|-------------|
| `id` | Match ID |
| `homeID` / `awayID` | Team IDs |
| `status` | `complete`, `incomplete`, `suspended`, `canceled` |
| `game_week` | Game week number |
| `date_unix` | Kick-off UNIX timestamp |
| `winningTeam` | Winner team ID (-1 if draw) |

### Goals
| Field | Description |
|-------|-------------|
| `homeGoalCount` / `awayGoalCount` | Team goals |
| `totalGoalCount` | Total goals |
| `homeGoals` / `awayGoals` | Goal timing arrays |
| `ht_goals_team_a` / `ht_goals_team_b` | Half-time goals |

### Match Stats
| Field | Description |
|-------|-------------|
| `team_a_corners` / `team_b_corners` | Corners |
| `team_a_shots` / `team_b_shots` | Total shots |
| `team_a_shotsOnTarget` / `team_b_shotsOnTarget` | Shots on target |
| `team_a_possession` / `team_b_possession` | Possession % |
| `team_a_fouls` / `team_b_fouls` | Fouls |
| `team_a_offsides` / `team_b_offsides` | Offsides |
| `team_a_yellow_cards` / `team_b_yellow_cards` | Yellow cards |
| `team_a_red_cards` / `team_b_red_cards` | Red cards |

### 🎰 ODDS
| Field | Description |
|-------|-------------|
| `odds_ft_1` | Home win odds |
| `odds_ft_x` | Draw odds |
| `odds_ft_2` | Away win odds |
| `odds_ft_over15` - `odds_ft_over45` | Over X goals odds |
| `odds_ft_under15` - `odds_ft_under45` | Under X goals odds |
| `odds_btts_yes` / `odds_btts_no` | BTTS odds |
| `odds_team_a_cs_yes/no` | Home clean sheet odds |
| `odds_team_b_cs_yes/no` | Away clean sheet odds |

### 🎯 PRE-MATCH PREDICTIONS (AI Critical!)
| Field | Description |
|-------|-------------|
| `btts_potential` | **BTTS % prediction** |
| `avg_potential` | **AVG goals prediction** |
| `o15_potential` - `o45_potential` | Over X goals potential |
| `u15_potential` - `u45_potential` | Under X goals potential |
| `o05HT_potential` - `o15HT_potential` | Over X first half potential |
| `corners_potential` | **Corners prediction** |
| `corners_o85_potential` - `corners_o105_potential` | Over X corners potential |
| `cards_potential` | Cards prediction |
| `offsides_potential` | Offsides prediction |
| `home_ppg` / `away_ppg` | Current PPG |
| `pre_match_home_ppg` / `pre_match_away_ppg` | Pre-match PPG |

### Match Outcome Flags (boolean)
| Field | Description |
|-------|-------------|
| `btts` | Did BTTS happen? |
| `over05` - `over55` | Did Over X happen? |
| `over65Corners` - `over145Corners` | Did Over X corners happen? |

## Notes
- 🔥 **`btts_potential`, `avg_potential`, `corners_potential`** = AI için hazır tahmin verileri!
- Bu veriler maç öncesi mevcut - tahmin kartında kullanılabilir
- Pagination: max 1000 maç/sayfa

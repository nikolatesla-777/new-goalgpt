# Match Details (Stats, H2H, Odds, Trends)

Complete match data including stats, H2H, odds comparison, trends, and lineups.

## Endpoint
```
GET https://api.football-data-api.com/match?key=YOURKEY&match_id=X
```

## Sample Request
```
https://api.football-data-api.com/match?key=example&match_id=579101
```

## Query Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `key` | string | ✅ | Your API Key |
| `match_id` | integer | ✅ | Match ID (from league-matches) |

## Response Highlights

### Match Info
| Field | Description |
|-------|-------------|
| `id` | Match ID |
| `homeID` / `awayID` | Team IDs |
| `home_name` / `away_name` | Team names |
| `status` | complete/suspended/canceled |
| `date_unix` | Kickoff timestamp |
| `stadium_name` | Venue |
| `refereeID` | Referee ID |

### 🎯 Full-Time Odds
| Field | Description |
|-------|-------------|
| `odds_ft_1` | Home win odds |
| `odds_ft_x` | Draw odds |
| `odds_ft_2` | Away win odds |
| `odds_ft_over05` - `over45` | Over X goals odds |
| `odds_ft_under05` - `under45` | Under X goals odds |
| `odds_btts_yes/no` | BTTS odds |

### 🎯 Corner Odds
| Field | Description |
|-------|-------------|
| `odds_corners_over_75` - `over_115` | Over X corners |
| `odds_corners_1/x/2` | Corner winner |

### 🎯 Pre-Match Potentials (AI Critical!)
| Field | Description |
|-------|-------------|
| `btts_potential` | **BTTS % prediction** |
| `avg_potential` | **Avg goals prediction** |
| `o25_potential` | **Over 2.5 % prediction** |
| `corners_potential` | Corners prediction |
| `cards_potential` | Cards prediction |
| `team_a_xg_prematch` | Pre-match xG home |
| `team_b_xg_prematch` | Pre-match xG away |

### Match Stats
| Field | Description |
|-------|-------------|
| `team_a/b_corners` | Corners |
| `team_a/b_shots` | Total shots |
| `team_a/b_shotsOnTarget` | Shots on target |
| `team_a/b_possession` | Possession % |
| `team_a/b_xg` | Actual xG |
| `team_a/b_yellow_cards` | Yellow cards |

### Goal Details
```json
"team_a_goal_details": [{
    "player_id": 8298,
    "time": "17",
    "assist_player_id": 4281
}]
```

### 🎯 H2H Data
```json
"h2h": {
    "previous_matches_results": {
        "team_a_wins": 0,
        "team_b_wins": 4,
        "draw": 1,
        "totalMatches": 5
    },
    "betting_stats": {
        "bttsPercentage": 60,
        "over25Percentage": 60,
        "avg_goals": 3.8
    }
}
```

### 🎯 Trends (Text Analysis)
```json
"trends": {
    "home": [
        ["chart", "Sheffield United has picked up 8 points from the last 5 games..."],
        ["bad", "Just 1 of the last 5 games has ended with both teams scoring."]
    ],
    "away": [
        ["great", "It's likely that Burnley will score today..."]
    ]
}
```

### Lineups & Bench
```json
"lineups": {
    "team_a": [{
        "player_id": 8298,
        "shirt_number": 7,
        "player_events": [{"event_type": "Goal", "event_time": "17"}]
    }]
}
```

### Weather
```json
"weather": {
    "temperature_celcius": {"temp": 7.8},
    "type": "shower rain",
    "wind": {"speed": "11.41 m/s"}
}
```

### Odds Comparison (Multiple Bookies)
```json
"odds_comparison": {
    "FT Result": {
        "1": {"BetFred": "2.38", "10Bet": "2.28"}
    }
}
```

## Notes
- 🔥 **This is THE endpoint for match detail page!**
- Contains everything: stats, H2H, odds, trends, lineups, weather
- `trends` provides human-readable AI insights
- `*_potential` fields are pre-match AI predictions
- `odds_comparison` shows odds from multiple bookmakers

# League Players

Get all players that participated in a league season with their stats.

## Endpoint
```
GET https://api.football-data-api.com/league-players?key=YOURKEY&season_id=X
```

## Sample Request
```
https://api.football-data-api.com/league-players?key=example&season_id=2012&include=stats
```

## Query Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `key` | string | ✅ | Your API Key |
| `season_id` | integer | ✅ | Season ID |
| `page` | integer | ❌ | Pagination (200 players/page) |
| `max_time` | integer | ❌ | UNIX timestamp for historical |

## Response (Sample)

```json
{
    "success": true,
    "data": [
        {
            "id": 2984,
            "competition_id": 161,
            "full_name": "Petr Čech",
            "first_name": "Petr",
            "last_name": "Čech",
            "known_as": "Petr Čech",
            "age": 36,
            "position": "Goalkeeper",
            "nationality": "Czech Republic",
            "club_team_id": 59,
            "appearances_overall": 34,
            "goals_overall": 0,
            "minutes_played_overall": 3040
        }
    ]
}
```

## Response Fields

### Player Info
| Field | Description |
|-------|-------------|
| `id` | Player ID |
| `full_name` | Full name |
| `first_name` / `last_name` | Name parts |
| `known_as` | Common name |
| `shorthand` | URL-safe name |
| `age` | Current age |
| `birthday` | UNIX timestamp |
| `nationality` | Country |
| `continent` | Continent code |
| `position` | Playing position |

### Team Info
| Field | Description |
|-------|-------------|
| `club_team_id` | Current club ID |
| `club_team_2_id` | Loan club ID (-1 if none) |
| `national_team_id` | National team ID (-1 if none) |

### Season Info
| Field | Description |
|-------|-------------|
| `competition_id` | Season ID |
| `league` | League name |
| `league_type` | League scale |
| `season` | Season year (e.g. "2017/2018") |
| `starting_year` / `ending_year` | Season years |

### Stats
| Field | Description |
|-------|-------------|
| `appearances_overall` | Total appearances |
| `appearances_home` | Home appearances |
| `appearances_away` | Away appearances |
| `goals_overall` | Goals scored |
| `minutes_played_overall` | Total minutes |
| `minutes_played_home` | Home minutes |
| `minutes_played_away` | Away minutes |

## Notes
- Pagination: Max 200 players per page
- For detailed player stats, see `/player` endpoint
- `club_team_id` links to league-teams data

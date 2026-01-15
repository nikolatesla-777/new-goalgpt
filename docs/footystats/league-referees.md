# League Referees

Get all referees in a league season with their statistics.

## Endpoint
```
GET https://api.football-data-api.com/league-referees?key=YOURKEY&season_id=X
```

## Query Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `key` | string | ✅ | Your API Key |
| `season_id` | integer | ✅ | Season ID |
| `max_time` | integer | ❌ | UNIX timestamp for historical |

## Response (Sample)

```json
{
    "success": true,
    "data": [
        {
            "id": 393,
            "full_name": "Michael Oliver",
            "nationality": "England",
            "appearances_overall": 32,
            "cards_per_match_overall": 3.28,
            "goals_per_match_overall": 3,
            "btts_percentage": 63,
            "penalties_given_per_match_overall": 0.16
        }
    ]
}
```

## Response Fields

### Referee Info
| Field | Description |
|-------|-------------|
| `id` | Referee ID |
| `full_name` | Full name |
| `nationality` | Country |
| `age` | Current age |
| `appearances_overall` | Matches officiated |

### 🎯 Goal Stats (AI Critical)
| Field | Description |
|-------|-------------|
| `goals_per_match_overall` | **AVG goals per match** |
| `btts_percentage` | **BTTS % in this ref's matches** |
| `min_per_goal_overall` | Minutes between goals |

### 🎯 Card Stats (AI Critical for Cards Market)
| Field | Description |
|-------|-------------|
| `cards_per_match_overall` | **AVG cards per match** |
| `yellow_cards_overall` | Total yellows |
| `red_cards_overall` | Total reds |
| `min_per_card_overall` | Minutes between cards |
| `over25_cards_percentage_overall` | Over 2.5 cards % |
| `over35_cards_percentage_overall` | Over 3.5 cards % |
| `over45_cards_percentage_overall` | Over 4.5 cards % |

### 🎯 Penalty Stats
| Field | Description |
|-------|-------------|
| `penalties_given_per_match_overall` | Penalties per match |
| `penalties_given_percentage_overall` | % matches with penalty |

### Match Outcomes
| Field | Description |
|-------|-------------|
| `wins_per_home` | Home win % |
| `wins_per_away` | Away win % |
| `draws_per` | Draw % |

## Notes
- 🔥 **Hakem istatistikleri kart tahminleri için çok değerli!**
- Bazı hakemler daha fazla kart veriyor - AI bunu kullanabilir
- `btts_percentage` ve `goals_per_match` ile gol tahminleri iyileştirilebilir

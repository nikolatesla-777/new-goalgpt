# League Stats (Season Stats)

Get season statistics and all teams in the league with their stats.

## Endpoint
```
GET https://api.football-data-api.com/league-season?key=YOURKEY&season_id=X
```

## Sample Request
```
https://api.football-data-api.com/league-season?key=example&season_id=2012
```

## Query Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `key` | string | ✅ | Your API Key |
| `season_id` | integer | ✅ | Season ID from league-list |
| `max_time` | integer | ❌ | UNIX timestamp for historical stats |

## Response (Sample)

```json
{
    "success": true,
    "data": [
        {
            "id": "161",
            "name": "Premier League",
            "country": "England",
            "season": "2017/2018",
            "clubNum": 20,
            "totalMatches": 380,
            "matchesCompleted": 380,
            "seasonAVG_overall": 2.68,
            "seasonBTTSPercentage": 52.4,
            "cornersAVG_overall": 10.5,
            "cardsAVG_overall": 3.2
        }
    ]
}
```

## Response Fields

### League Info
| Field | Description |
|-------|-------------|
| `id` | Season ID |
| `name` | League name |
| `country` | Country name |
| `domestic_scale` | Importance within country (ranking) |
| `international_scale` | Global importance |
| `clubNum` | Number of clubs |
| `season` | Season year (e.g. "2017/2018") |
| `starting_year` / `ending_year` | Season years |

### Season Progress
| Field | Description |
|-------|-------------|
| `totalMatches` | Total matches in season |
| `matchesCompleted` | Completed matches |
| `game_week` | Current game week |
| `progress` | Season progress % |

### 🎯 GOAL STATS (AI Critical)
| Field | Description |
|-------|-------------|
| `total_goals` | Total goals this season |
| `seasonAVG_overall` | **AVG goals per match** |
| `seasonAVG_home` | AVG home team goals |
| `seasonAVG_away` | AVG away team goals |

### 🎯 BTTS & CLEAN SHEET (AI Critical)
| Field | Description |
|-------|-------------|
| `btts_matches` | Matches ending BTTS |
| `seasonBTTSPercentage` | **BTTS %** |
| `seasonCSPercentage` | Clean sheet % |
| `home_teams_clean_sheets` | Home clean sheets |
| `away_teams_clean_sheets` | Away clean sheets |
| `home_teams_failed_to_score` | Home FTS count |
| `away_teams_failed_to_score` | Away FTS count |

### 🎯 OVER/UNDER PERCENTAGES (AI Critical)
| Field | Description |
|-------|-------------|
| `seasonOver05Percentage_overall` | Over 0.5 goals % |
| `seasonOver15Percentage_overall` | Over 1.5 goals % |
| `seasonOver25Percentage_overall` | **Over 2.5 goals %** |
| `seasonOver35Percentage_overall` | Over 3.5 goals % |
| `seasonOver45Percentage_overall` | Over 4.5 goals % |
| `seasonOver55Percentage_overall` | Over 5.5 goals % |
| `seasonUnder05Percentage_overall` | Under 0.5 % |
| `seasonUnder15Percentage_overall` | Under 1.5 % |
| `seasonUnder25Percentage_overall` | **Under 2.5 %** |

### 🎯 CORNER STATS (AI Critical)
| Field | Description |
|-------|-------------|
| `cornersAVG_overall` | **AVG corners per match** |
| `cornersAVG_home` | Home corners AVG |
| `cornersAVG_away` | Away corners AVG |
| `cornersTotal_overall` | Total corners |
| `over65CornersPercentage_overall` | Over 6.5 corners % |
| `over85CornersPercentage_overall` | Over 8.5 corners % |
| `over95CornersPercentage_overall` | **Over 9.5 corners %** |
| `over105CornersPercentage_overall` | Over 10.5 corners % |

### 🎯 CARD STATS
| Field | Description |
|-------|-------------|
| `cardsAVG_overall` | AVG cards per match |
| `cardsTotal_overall` | Total cards |
| `over25CardsPercentage_overall` | Over 2.5 cards % |
| `over35CardsPercentage_overall` | Over 3.5 cards % |
| `over45CardsPercentage_overall` | Over 4.5 cards % |

### Match Results
| Field | Description |
|-------|-------------|
| `homeWins` | Home wins count |
| `draws` | Draws count |
| `awayWins` | Away wins count |
| `homeWinPercentage` | Home win % |
| `drawPercentage` | Draw % |
| `awayWinPercentage` | Away win % |

### First/Second Half Goals
| Field | Description |
|-------|-------------|
| `over05_fhg_percentage` | Over 0.5 first half goals % |
| `over15_fhg_percentage` | Over 1.5 first half goals % |
| `over05_2hg_percentage` | Over 0.5 second half goals % |
| `over15_2hg_percentage` | Over 1.5 second half goals % |

### Goal Timing
| Field | Description |
|-------|-------------|
| `goals_min_0_to_10` | Goals in 0-10 min |
| `goals_min_11_to_20` | Goals in 11-20 min |
| ... | ... |
| `goals_min_76_to_90` | Goals in 76-90 min |

## Notes
- 🔥 **Bu endpoint AI tahmin modeli için en değerli!**
- BTTS%, Over/Under%, Corner% gibi istatistikler hazır geliyor
- `max_time` ile geçmiş tarihteki istatistikleri alabilirsin

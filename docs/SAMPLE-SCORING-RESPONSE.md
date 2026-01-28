# Sample Scoring API Response

**Endpoint**: `GET /api/matches/:id/scoring?markets=O25,BTTS&locale=tr`

**Date**: 2026-01-29

---

## Scenario 1: FootyStats Linked (Hybrid Mode)

**Request**:
```bash
curl "http://localhost:3000/api/matches/12345678/scoring?markets=O25,BTTS&locale=tr"
```

**Response** (200 OK):
```json
{
  "match_id": "12345678",
  "source_refs": {
    "thesports_match_id": "12345678",
    "thesports_internal_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "footystats_match_id": 456789,
    "footystats_linked": true,
    "link_method": "stored_mapping"
  },
  "features": {
    "source": "hybrid",
    "match_id": "12345678",
    "kickoff_ts": 1706553600,
    "home_team": {
      "id": "team-123",
      "name": "Barcelona"
    },
    "away_team": {
      "id": "team-456",
      "name": "Real Madrid"
    },
    "league": {
      "id": "league-1",
      "name": "LaLiga"
    },
    "xg": {
      "home": 1.65,
      "away": 1.20,
      "total": 2.85
    },
    "odds": {
      "home_win": 2.10,
      "draw": 3.40,
      "away_win": 3.50
    },
    "potentials": {
      "over25": 68,
      "btts": 72,
      "over05_ht": 65,
      "over15": 85,
      "over35": 45,
      "corners_over85": 55,
      "cards_over25": 48
    },
    "ft_scores": {
      "home": 3,
      "away": 1,
      "total": 4
    },
    "ht_scores": {
      "home": 2,
      "away": 0,
      "total": 2
    },
    "corners": {
      "home": 7,
      "away": 4,
      "total": 11
    },
    "cards": {
      "home": 2,
      "away": 1,
      "total": 3
    },
    "completeness": {
      "present": [
        "ft_scores",
        "ht_scores",
        "corners",
        "cards",
        "xg",
        "odds",
        "potentials"
      ],
      "missing": [
        "form",
        "h2h",
        "league_stats"
      ]
    }
  },
  "risk_flags": [],
  "results": [
    {
      "match_id": "12345678",
      "fs_match_id": 456789,
      "market_id": "O25",
      "market_name": "2.5 Üst Gol",
      "probability": 0.6850,
      "confidence": 72,
      "pick": "YES",
      "edge": 0.15,
      "components": [
        {
          "name": "prior_probability",
          "weight": 0.25,
          "raw_value": 0.68,
          "weighted_contribution": 0.17,
          "is_available": true,
          "data_source": "footystats.potentials.over25"
        },
        {
          "name": "poisson_distribution",
          "weight": 0.40,
          "raw_value": 0.73,
          "weighted_contribution": 0.292,
          "is_available": true,
          "data_source": "footystats.xg"
        },
        {
          "name": "form_adjustment",
          "weight": 0.20,
          "raw_value": 0.65,
          "weighted_contribution": 0.13,
          "is_available": true,
          "data_source": "footystats.trends"
        },
        {
          "name": "btts_correlation",
          "weight": 0.15,
          "raw_value": 0.05,
          "weighted_contribution": 0.0075,
          "is_available": true,
          "data_source": "footystats.potentials.btts"
        }
      ],
      "risk_flags": [],
      "data_score": 95,
      "metadata": {
        "lambda_total": 2.85,
        "lambda_home": 1.65,
        "lambda_away": 1.20,
        "implied_prob": 0.4762
      },
      "scored_at": 1706553700,
      "can_publish": true,
      "publish_reason": "✅ All checks passed - eligible for publish",
      "failed_checks": [],
      "passed_checks": [
        "Pick is YES",
        "Confidence 72 >= 60",
        "Probability 0.69 >= 0.60",
        "Edge 0.15 > 0",
        "No blocking risk flags",
        "All required fields present: xg_prematch, potentials.over25",
        "Lambda total 2.85 >= 2.4"
      ]
    },
    {
      "match_id": "12345678",
      "fs_match_id": 456789,
      "market_id": "BTTS",
      "market_name": "Karşılıklı Gol",
      "probability": 0.7120,
      "confidence": 78,
      "pick": "YES",
      "edge": 0.12,
      "components": [
        {
          "name": "prior_probability",
          "weight": 0.30,
          "raw_value": 0.72,
          "weighted_contribution": 0.216,
          "is_available": true,
          "data_source": "footystats.potentials.btts"
        },
        {
          "name": "independent_poisson",
          "weight": 0.45,
          "raw_value": 0.68,
          "weighted_contribution": 0.306,
          "is_available": true,
          "data_source": "footystats.xg"
        },
        {
          "name": "h2h_btts",
          "weight": 0.25,
          "raw_value": 0.75,
          "weighted_contribution": 0.1875,
          "is_available": true,
          "data_source": "footystats.h2h"
        }
      ],
      "risk_flags": [],
      "data_score": 92,
      "metadata": {
        "lambda_home": 1.65,
        "lambda_away": 1.20,
        "home_scoring_prob": 0.8088,
        "away_scoring_prob": 0.6988,
        "implied_prob": 0.4762
      },
      "scored_at": 1706553700,
      "can_publish": true,
      "publish_reason": "✅ All checks passed - eligible for publish",
      "failed_checks": [],
      "passed_checks": [
        "Pick is YES",
        "Confidence 78 >= 65",
        "Probability 0.71 >= 0.60",
        "Edge 0.12 > 0",
        "No blocking risk flags",
        "All required fields present: xg_prematch, potentials.btts",
        "Both teams scoring prob >= 55% (home: 80.9%, away: 69.9%)"
      ]
    }
  ],
  "generated_at": 1706553700
}
```

---

## Scenario 2: FootyStats NOT Linked (TheSports Only)

**Request**:
```bash
curl "http://localhost:3000/api/matches/87654321/scoring?markets=O25,BTTS"
```

**Response** (200 OK):
```json
{
  "match_id": "87654321",
  "source_refs": {
    "thesports_match_id": "87654321",
    "thesports_internal_id": "x9y8z7w6-v5u4-3210-9876-543210fedcba",
    "footystats_match_id": null,
    "footystats_linked": false,
    "link_method": "not_found"
  },
  "features": {
    "source": "thesports",
    "match_id": "87654321",
    "kickoff_ts": 1706640000,
    "home_team": {
      "id": "team-789",
      "name": "Manchester City"
    },
    "away_team": {
      "id": "team-012",
      "name": "Liverpool"
    },
    "ft_scores": {
      "home": 2,
      "away": 2,
      "total": 4
    },
    "ht_scores": {
      "home": 1,
      "away": 1,
      "total": 2
    },
    "corners": {
      "home": 8,
      "away": 6,
      "total": 14
    },
    "cards": {
      "home": 3,
      "away": 2,
      "total": 5
    },
    "xg": null,
    "odds": null,
    "potentials": null,
    "completeness": {
      "present": [
        "ft_scores",
        "ht_scores",
        "corners",
        "cards"
      ],
      "missing": [
        "xg",
        "odds",
        "potentials",
        "form",
        "h2h",
        "league_stats"
      ]
    }
  },
  "risk_flags": [
    "MISSING_XG",
    "MISSING_ODDS",
    "MISSING_POTENTIALS"
  ],
  "results": [
    {
      "match_id": "87654321",
      "fs_match_id": 0,
      "market_id": "O25",
      "market_name": "Over 2.5 Goals",
      "probability": 0,
      "confidence": 0,
      "pick": "NO",
      "edge": null,
      "components": [],
      "risk_flags": [
        "MISSING_XG",
        "MISSING_POTENTIALS"
      ],
      "data_score": 0,
      "metadata": {},
      "scored_at": 1706640100,
      "can_publish": false,
      "publish_reason": "❌ Failed 1 check(s): Required field \"xg_prematch\" is missing (xG data unavailable)",
      "failed_checks": [
        "Pick is NO (must be YES)",
        "Confidence 0 < 60 (threshold)",
        "Probability 0.0000 < 0.60 (threshold)",
        "Required field \"xg_prematch\" is missing (xG data unavailable)"
      ],
      "passed_checks": []
    },
    {
      "match_id": "87654321",
      "fs_match_id": 0,
      "market_id": "BTTS",
      "market_name": "Both Teams To Score",
      "probability": 0,
      "confidence": 0,
      "pick": "NO",
      "edge": null,
      "components": [],
      "risk_flags": [
        "MISSING_XG",
        "MISSING_POTENTIALS"
      ],
      "data_score": 0,
      "metadata": {},
      "scored_at": 1706640100,
      "can_publish": false,
      "publish_reason": "❌ Failed 2 check(s): Pick is NO (must be YES)",
      "failed_checks": [
        "Pick is NO (must be YES)",
        "Confidence 0 < 65 (threshold)",
        "Required field \"xg_prematch\" is missing (xG data unavailable)",
        "Scoring probabilities missing (xG data unavailable)"
      ],
      "passed_checks": []
    }
  ],
  "generated_at": 1706640100
}
```

---

## Scenario 3: Invalid Market IDs

**Request**:
```bash
curl "http://localhost:3000/api/matches/12345678/scoring?markets=O25,INVALID_MARKET"
```

**Response** (400 Bad Request):
```json
{
  "error": "Invalid market IDs",
  "details": {
    "invalid": [
      "INVALID_MARKET"
    ],
    "allowed": [
      "O25",
      "BTTS",
      "HT_O05",
      "O35",
      "HOME_O15",
      "CORNERS_O85",
      "CARDS_O25"
    ]
  }
}
```

---

## Scenario 4: Match Not Found

**Request**:
```bash
curl "http://localhost:3000/api/matches/nonexistent-match/scoring"
```

**Response** (404 Not Found):
```json
{
  "error": "Match not found: nonexistent-match"
}
```

---

## Key Fields Explanation

### source_refs
- **thesports_match_id**: TheSports external match ID
- **thesports_internal_id**: Internal UUID from ts_matches table
- **footystats_match_id**: FootyStats match ID (if linked)
- **footystats_linked**: Whether FootyStats data was found
- **link_method**: How FootyStats was linked (stored_mapping | deterministic_match | not_found)

### features.completeness
- **present[]**: List of available data fields
- **missing[]**: List of unavailable data fields

### results[].metadata
- **lambda_total**: Total xG (for O25, O35 markets)
- **lambda_home**: Home team xG (for HOME_O15)
- **lambda_away**: Away team xG
- **home_scoring_prob**: P(home scores) for BTTS validation
- **away_scoring_prob**: P(away scores) for BTTS validation
- **implied_prob**: Implied probability from odds (for edge calculation)

### results[].can_publish
- **true**: Prediction eligible for publishing
- **false**: Prediction blocked (see failed_checks for reasons)

### results[].publish_reason
- Clear explanation of why prediction can/cannot be published

### results[].failed_checks
- Array of specific validation failures
- Examples:
  - "Required field \"xg_prematch\" is missing (xG data unavailable)"
  - "Confidence 55 < 60 (threshold)"
  - "Probability 0.58 < 0.60 (threshold)"
  - "Pick is NO (must be YES)"

### results[].passed_checks
- Array of successful validations
- Shows which criteria were met

---

## Testing Commands

### Get all 7 markets
```bash
curl http://localhost:3000/api/matches/12345678/scoring
```

### Filter markets
```bash
curl "http://localhost:3000/api/matches/12345678/scoring?markets=O25,BTTS"
```

### Turkish locale
```bash
curl "http://localhost:3000/api/matches/12345678/scoring?locale=tr"
```

### Get available markets
```bash
curl http://localhost:3000/api/scoring/markets
```

**Response**:
```json
{
  "markets": [
    {
      "id": "O25",
      "display_name": "Over 2.5 Goals",
      "display_name_tr": "2.5 Üst Gol"
    },
    {
      "id": "BTTS",
      "display_name": "Both Teams To Score",
      "display_name_tr": "Karşılıklı Gol"
    },
    {
      "id": "HT_O05",
      "display_name": "Half-Time Over 0.5",
      "display_name_tr": "İlk Yarı 0.5 Üst"
    },
    {
      "id": "O35",
      "display_name": "Over 3.5 Goals",
      "display_name_tr": "3.5 Üst Gol"
    },
    {
      "id": "HOME_O15",
      "display_name": "Home Over 1.5",
      "display_name_tr": "Ev Sahibi 1.5 Üst"
    },
    {
      "id": "CORNERS_O85",
      "display_name": "Corners Over 8.5",
      "display_name_tr": "Korner 8.5 Üst"
    },
    {
      "id": "CARDS_O25",
      "display_name": "Cards Over 2.5",
      "display_name_tr": "Kart 2.5 Üst"
    }
  ]
}
```

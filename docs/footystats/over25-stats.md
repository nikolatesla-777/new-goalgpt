# Over 2.5 Stats

Get top teams, fixtures, and leagues for Over 2.5 Goals.

## Endpoint
```
GET https://api.football-data-api.com/stats-data-over25?key=YOURKEY
```

## Query Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `key` | string | ✅ | Your API Key |

## Response Structure

```json
{
    "data": {
        "top_teams": {
            "title": "Over 2.5 Teams",
            "list_type": "teams",
            "data": []
        },
        "top_fixtures": {
            "title": "Over 2.5 Fixtures",
            "list_type": "fixtures",
            "data": []
        },
        "top_leagues": {
            "title": "Over 2.5 Leagues",
            "list_type": "leagues",
            "data": []
        }
    }
}
```

## Data Fields

| Field | Description |
|-------|-------------|
| `top_teams` | Teams with highest Over 2.5 % |
| `top_fixtures` | Best upcoming Over 2.5 fixtures |
| `top_leagues` | Leagues with most Over 2.5 |

## 🎯 AI Use Cases

- **Daily Over 2.5 Picks**: Use `top_fixtures` for high-scoring match predictions
- **League Selection**: Target high-scoring leagues
- **Team Patterns**: Find attacking teams

## Notes
- 🔥 **Ready-made Over 2.5 rankings**
- Perfect for "Goals Tip of the Day" feature
- Combine with BTTS stats for combo bets

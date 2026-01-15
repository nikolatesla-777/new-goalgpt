# BTTS Stats

Get top teams, fixtures, and leagues for BTTS (Both Teams To Score).

## Endpoint
```
GET https://api.football-data-api.com/stats-data-btts?key=YOURKEY
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
            "title": "BTTS Teams",
            "list_type": "teams",
            "data": []
        },
        "top_fixtures": {
            "title": "BTTS Fixtures",
            "list_type": "fixtures",
            "data": []
        },
        "top_leagues": {
            "title": "BTTS Leagues",
            "list_type": "leagues",
            "data": []
        }
    }
}
```

## Data Fields

| Field | Description |
|-------|-------------|
| `top_teams` | Best BTTS teams ranked |
| `top_fixtures` | Best upcoming BTTS fixtures |
| `top_leagues` | Leagues with highest BTTS % |
| `list_type` | "teams", "leagues", or "fixtures" |

## 🎯 AI Use Cases

- **Daily BTTS Picks**: Use `top_fixtures` for today's best BTTS bets
- **League Analysis**: Identify high-BTTS leagues
- **Team Patterns**: Find consistent BTTS teams

## Notes
- 🔥 **Ready-made BTTS rankings** - no calculation needed
- Perfect for "BTTS Tip of the Day" feature
- Combine with match odds for value bets

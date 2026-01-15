# League List

Get all leagues available in the FootyStats API database.

## Endpoint
```
GET https://api.football-data-api.com/league-list?key=YOURKEY
```

## Sample Request
```
https://api.football-data-api.com/league-list?key=example
```

## Query Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `key` | string | ✅ | Your API Key |
| `chosen_leagues_only` | string | ❌ | If "true", only returns user's selected leagues |
| `country` | integer | ❌ | ISO country code (remove leading 0s) |

## Response

```json
{
    "success": true,
    "data": [
        {
            "name": "USA MLS",
            "season": [
                {
                    "id": 1,
                    "year": 2016
                },
                {
                    "id": 16,
                    "year": 2015
                },
                {
                    "id": 1076,
                    "year": 2018
                }
            ]
        }
    ]
}
```

## Response Fields

| Field | Description |
|-------|-------------|
| `name` | Name of the league |
| `league_name` | Name of the league without country |
| `country` | Country name |
| `season.id` | **Unique ID of the season** (use this in other endpoints) |
| `season.year` | Year of the season |

## Notes
- Each season of a competition has a **unique ID**
- Use `season.id` for other API calls like `/league-matches?league_id=XXX`

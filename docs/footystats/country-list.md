# Country List

Get all countries and their ISO numbers for filtering other endpoints.

## Endpoint
```
GET https://api.football-data-api.com/country-list?key=YOURKEY
```

## Sample Request
```
https://api.football-data-api.com/country-list?key=example
```

## Query Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `key` | string | ✅ | Your API Key |

## Response

```json
{
    "success": true,
    "data": [
        {
            "id": 4,
            "name": "Afghanistan"
        },
        {
            "id": 901,
            "name": "Africa"
        },
        {
            "id": 248,
            "name": "Åland Islands"
        },
        {
            "id": 8,
            "name": "Albania"
        }
    ]
}
```

## Response Fields

| Field | Description |
|-------|-------------|
| `id` | ISO number of the country (use in other endpoints) |
| `name` | Name of the country |

## Usage Notes
- Use `id` to filter `/league-list?country=XXX`
- Turkey's ISO code: **792** (Türkiye için)

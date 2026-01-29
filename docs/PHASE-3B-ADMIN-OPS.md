# PHASE-3B: ADMIN OPS - IMPLEMENTATION GUIDE

**Epic**: Admin Panel → Production Operations Tool
**Version**: 1.0
**Date**: 2026-01-29
**Status**: Complete

---

## OVERVIEW

Phase-3B transforms the admin panel into a production-grade operations tool with:

- **Phase-3B.1**: AI Match Summary (deterministic templates + schema validation)
- **Phase-3B.2**: Bulk Preview + Bulk Publish (daily list operations)
- **Phase-3B.3**: Image Generation (SVG templates for social media)
- **Phase-3B.4**: Scheduler/Auto-Publish (feature-flagged automation)
- **Phase-3B.5**: Security Hardening (IP allowlist + rate limiting + audit logs)

---

## PHASE-3B.1: AI MATCH SUMMARY

### Endpoint

```
POST /api/admin/ai-summary
```

### Authentication

```
Headers:
  x-admin-api-key: <ADMIN_API_KEY>
```

### Request

```json
{
  "match_id": "string",
  "locale": "tr" | "en"
}
```

### Response

```json
{
  "success": true,
  "data": {
    "match_id": "12345",
    "title": "Barcelona vs Real Madrid - La Liga Analizi",
    "key_angles": [
      {
        "icon": "⚡",
        "title": "Yüksek Gol Potansiyeli",
        "description": "Her iki takım da yüksek xG değerlerine sahip (2.85). Gollü bir maç bekleniyor."
      }
    ],
    "bet_ideas": [
      {
        "market": "Over 2.5",
        "reason": "Güçlü ofansif performans",
        "confidence": 72
      }
    ],
    "disclaimer": "Risk uyarısı: Bahis oynamanın riskleri vardır.",
    "generated_at": "2026-01-29T19:30:00Z",
    "locale": "tr"
  }
}
```

### Usage Example

```bash
curl -X POST http://localhost:3000/api/admin/ai-summary \
  -H "x-admin-api-key: your_admin_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "match_id": "12345",
    "locale": "tr"
  }'
```

---

## PHASE-3B.2: BULK PREVIEW + BULK PUBLISH

### Endpoint: Bulk Preview

```
POST /api/admin/bulk-preview
```

### Request

```json
{
  "date_from": "2026-01-29T00:00:00Z",
  "date_to": "2026-01-30T00:00:00Z",
  "markets": ["O25", "BTTS", "HT_O05", "O35", "HOME_O15", "CORNERS_O85", "CARDS_O25"],
  "filters": {
    "min_confidence": 60,
    "min_probability": 0.60,
    "max_risk_flags": 2,
    "max_per_league": 2,
    "time_spread_minutes": 90
  },
  "limit_per_market": 5,
  "locale": "tr"
}
```

### Response

```json
{
  "success": true,
  "data": {
    "generated_at": "2026-01-29T19:30:00Z",
    "filters_applied": { "..." },
    "markets": [
      {
        "market_id": "O25",
        "market_name": "2.5 Üst Gol",
        "market_name_tr": "2.5 Üst Gol",
        "market_name_en": "Over 2.5 Goals",
        "emoji": "📈",
        "picks": [
          {
            "match_id": "12345",
            "fs_match_id": 54321,
            "kickoff_time": 1738191600,
            "league": "Premier League",
            "home_team": "Manchester City",
            "away_team": "Liverpool",
            "probability": 0.72,
            "confidence": 75,
            "pick": "YES",
            "can_publish": true,
            "risk_flags": [],
            "reasons": {
              "passed": [
                "Confidence 75/100 (threshold: 60)",
                "Probability 72.0% (threshold: 60.0%)"
              ],
              "failed": []
            }
          }
        ],
        "total_candidates": 12,
        "total_selected": 5
      }
    ]
  }
}
```

### Endpoint: Bulk Publish

```
POST /api/admin/bulk-publish
```

### Request

```json
{
  "admin_user_id": "admin@goalgpt.com",
  "dry_run": true,
  "picks": [
    {
      "match_id": "12345",
      "market_id": "O25",
      "locale": "tr",
      "template_version": "v1"
    }
  ]
}
```

### Response

```json
{
  "success": true,
  "data": {
    "summary": {
      "total": 5,
      "sent": 3,
      "failed": 1,
      "skipped": 1
    },
    "results": [
      {
        "match_id": "12345",
        "market_id": "O25",
        "status": "sent",
        "telegram_message_id": 123456,
        "dry_run": false
      },
      {
        "match_id": "67890",
        "market_id": "BTTS",
        "status": "skipped",
        "reason": "Not eligible: Confidence below threshold",
        "dry_run": false
      }
    ]
  }
}
```

### DRY_RUN Mode

When `dry_run: true`:
- **NO** actual Telegram publishing
- Audit logs written with `status: dry_run_success`
- Full response structure returned for testing

### Audit Logging

All publish attempts (including dry_run) are logged to `admin_publish_logs`:

```sql
CREATE TABLE admin_publish_logs (
  id UUID PRIMARY KEY,
  admin_user_id VARCHAR(255) NOT NULL,
  match_id VARCHAR(255) NOT NULL,
  market_id VARCHAR(20) NOT NULL,
  dry_run BOOLEAN NOT NULL DEFAULT FALSE,
  payload JSONB NOT NULL,
  status VARCHAR(50) NOT NULL, -- 'dry_run_success', 'sent', 'failed', 'skipped'
  telegram_message_id BIGINT,
  error_message TEXT,
  request_id VARCHAR(100),
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## PHASE-3B.3: IMAGE GENERATION

### Endpoint

```
POST /api/admin/generate-image
```

### Request

```json
{
  "match_id": "12345",
  "market_id": "O25",
  "locale": "tr",
  "style": "story" | "post"
}
```

### Response

```json
{
  "success": true,
  "data": {
    "image_base64": "PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4...",
    "template_version": "v1",
    "dimensions": {
      "width": 1080,
      "height": 1920
    }
  }
}
```

### Image Styles

| Style | Dimensions | Use Case |
|-------|------------|----------|
| `story` | 1080x1920 | Instagram Story format |
| `post` | 1080x1080 | Square post (Instagram/Twitter) |

### Template Features

- Deterministic SVG generation (NO LLM)
- Team names + league info
- Market badge with emoji
- Confidence + probability visualization
- Kickoff time (localized)
- Disclaimer text
- Gradient background with brand colors

### Decoding Image

```javascript
// Convert base64 to file
const imageBuffer = Buffer.from(response.data.image_base64, 'base64');
fs.writeFileSync('prediction.svg', imageBuffer);
```

---

## PHASE-3B.4: SCHEDULER / AUTO-PUBLISH

### Jobs

#### Daily Auto-Preview

**Schedule**: Daily at 08:00 UTC
**Job Name**: `Daily Auto-Preview`
**Status**: Enabled

**Purpose**: Generate DRY_RUN preview reports for admin review

**Configuration**:
```env
AUTO_PREVIEW_MIN_CONFIDENCE=60
AUTO_PREVIEW_MIN_PROBABILITY=0.60
AUTO_PREVIEW_MAX_RISK_FLAGS=2
AUTO_PREVIEW_MAX_PER_LEAGUE=2
AUTO_PREVIEW_TIME_SPREAD_MINUTES=90
AUTO_PREVIEW_LIMIT_PER_MARKET=5
```

#### Daily Auto-Publish

**Schedule**: Daily at 09:00 UTC (1 hour after preview)
**Job Name**: `Daily Auto-Publish`
**Status**: Disabled (feature-flagged)

**Purpose**: Automatically publish predictions to Telegram

**Feature Flags**:
```env
AUTO_PUBLISH_ENABLED=false  # MUST be true to enable
AUTO_PUBLISH_DRY_RUN=true   # Set to false for real publishing
```

**Configuration**:
```env
AUTO_PUBLISH_MIN_CONFIDENCE=65
AUTO_PUBLISH_MIN_PROBABILITY=0.65
AUTO_PUBLISH_MAX_RISK_FLAGS=1
AUTO_PUBLISH_MAX_PER_LEAGUE=1
AUTO_PUBLISH_TIME_SPREAD_MINUTES=120
AUTO_PUBLISH_LIMIT_PER_MARKET=3
MAX_PUBLISH_PER_RUN=20  # Kill switch: prevent runaway publishing
```

### Enable Auto-Publish

```bash
# Step 1: Test with DRY_RUN
export AUTO_PUBLISH_ENABLED=true
export AUTO_PUBLISH_DRY_RUN=true

# Verify logs for 1 week

# Step 2: Enable real publishing
export AUTO_PUBLISH_DRY_RUN=false

# Monitor admin_publish_logs table
```

### Kill Switch

If auto-publish attempts to publish more than `MAX_PUBLISH_PER_RUN` picks:
- Job will truncate to the limit
- Logs warning: `KILL SWITCH: ${count} picks exceeds limit`
- Prevents runaway automation

---

## PHASE-3B.5: SECURITY HARDENING

### ADMIN_API_KEY Authentication

**Required on ALL `/api/admin` endpoints**

```bash
curl -H "x-admin-api-key: your_admin_api_key" \
  https://api.goalgpt.com/api/admin/ai-summary
```

**Setup**:
```env
ADMIN_API_KEY=randomly_generated_64_char_key
```

**Generate Key**:
```bash
openssl rand -hex 32
```

### IP Allowlist

**Configuration**:
```env
ADMIN_IP_ALLOWLIST=127.0.0.1,192.168.1.100,10.0.0.50
```

- Comma-separated list of allowed IPs
- If not set: **all IPs allowed** (opt-in security)
- Returns `403 Forbidden` for non-allowlisted IPs

### Rate Limiting

**Default**: 60 requests per minute per IP

**Configuration**:
```env
ADMIN_RATE_LIMIT=60
```

- In-memory rate limiter (simple MVP)
- Returns `429 Too Many Requests` when exceeded
- Response includes `retry_after` seconds

**Response Example**:
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Max 60 requests per minute.",
  "retry_after": 45
}
```

### Request Correlation

Every admin request generates a unique `request_id` (UUID):
- Logged in `admin_publish_logs.request_id`
- Includes `ip_address` and `user_agent`
- Helps trace admin actions

---

## DEPLOYMENT

### Environment Variables

```env
# ADMIN API KEY (REQUIRED)
ADMIN_API_KEY=your_randomly_generated_64_char_key

# IP ALLOWLIST (OPTIONAL)
ADMIN_IP_ALLOWLIST=127.0.0.1,your_server_ip

# RATE LIMITING (OPTIONAL, default: 60)
ADMIN_RATE_LIMIT=60

# AUTO-PREVIEW CONFIGURATION (OPTIONAL)
AUTO_PREVIEW_MIN_CONFIDENCE=60
AUTO_PREVIEW_MIN_PROBABILITY=0.60
AUTO_PREVIEW_MAX_RISK_FLAGS=2
AUTO_PREVIEW_MAX_PER_LEAGUE=2
AUTO_PREVIEW_TIME_SPREAD_MINUTES=90
AUTO_PREVIEW_LIMIT_PER_MARKET=5

# AUTO-PUBLISH CONFIGURATION (OPTIONAL)
AUTO_PUBLISH_ENABLED=false
AUTO_PUBLISH_DRY_RUN=true
AUTO_PUBLISH_MIN_CONFIDENCE=65
AUTO_PUBLISH_MIN_PROBABILITY=0.65
AUTO_PUBLISH_MAX_RISK_FLAGS=1
AUTO_PUBLISH_MAX_PER_LEAGUE=1
AUTO_PUBLISH_TIME_SPREAD_MINUTES=120
AUTO_PUBLISH_LIMIT_PER_MARKET=3
MAX_PUBLISH_PER_RUN=20
```

### Database Migration

```bash
# Run migration for admin_publish_logs table
npm run migrate:up -- 007-admin-publish-logs.ts
```

### Job Registration

Jobs are automatically registered in `src/jobs/jobManager.ts`:
- `Daily Auto-Preview` (enabled)
- `Daily Auto-Publish` (disabled by default)

### Smoke Test

```bash
# Test API key auth
curl -X POST http://localhost:3000/api/admin/ai-summary \
  -H "x-admin-api-key: test_key" \
  -H "Content-Type: application/json" \
  -d '{"match_id": "12345", "locale": "tr"}'

# Expected: 401 Unauthorized (invalid key)

# Test bulk-preview
curl -X POST http://localhost:3000/api/admin/bulk-preview \
  -H "x-admin-api-key: $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "date_from": "2026-01-29T00:00:00Z",
    "date_to": "2026-01-30T00:00:00Z",
    "markets": ["O25"],
    "filters": {
      "min_confidence": 60,
      "min_probability": 0.60,
      "max_risk_flags": 2,
      "max_per_league": 2,
      "time_spread_minutes": 90
    },
    "limit_per_market": 5,
    "locale": "tr"
  }'

# Expected: 503 (Week-2A endpoint not available yet) OR 200 with data
```

---

## ERROR CODES

| Code | Error | Reason |
|------|-------|--------|
| 400 | Bad Request | Invalid/missing required fields |
| 401 | Unauthorized | Missing/invalid ADMIN_API_KEY |
| 403 | Forbidden | IP not in allowlist |
| 429 | Too Many Requests | Rate limit exceeded |
| 503 | Service Unavailable | Week-2A endpoint not available |

---

## MONITORING

### Audit Logs Query

```sql
-- View all publish attempts (last 24h)
SELECT
  admin_user_id,
  match_id,
  market_id,
  status,
  dry_run,
  created_at
FROM admin_publish_logs
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Success rate by admin
SELECT
  admin_user_id,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE status = 'sent') AS sent,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed,
  COUNT(*) FILTER (WHERE status = 'skipped') AS skipped,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'sent') / COUNT(*), 2) AS success_rate
FROM admin_publish_logs
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY admin_user_id;
```

### Job Logs

```bash
# View auto-preview logs
grep "DailyAutoPreview" logs/app.log | tail -50

# View auto-publish logs
grep "DailyAutoPublish" logs/app.log | tail -50
```

---

## NEXT STEPS

- [ ] Merge Week-2A (PR#5) for scoring endpoint integration
- [ ] Merge Week-2B (PR#6) for Telegram channelRouter integration
- [ ] Test bulk operations with real match data
- [ ] Enable AUTO_PUBLISH_ENABLED after 1 week of DRY_RUN validation
- [ ] Add email notification for auto-preview reports
- [ ] Add Grafana dashboard for admin operations metrics

---

**Last Updated**: 2026-01-29
**Author**: Claude (AI Assistant)
**Status**: Complete

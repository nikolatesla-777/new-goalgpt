# Week-2A Staging Verification Guide

## Overview
This guide provides steps to verify the Week-2A scoring endpoint in staging environment.

## Prerequisites
- Server running on staging (port 3000)
- Database with recent match data
- `curl` and `jq` installed for API testing

## Test Scenarios

### Scenario 1: TheSports-Only Match (No FootyStats Link)

**Expected Behavior:**
- `footystats_linked: false`
- Risk flags include `MISSING_XG`, `MISSING_ODDS`, `MISSING_POTENTIALS`
- xG-required markets (O25, BTTS, HOME_O15) should NOT be publishable
- Low confidence scores (<60) due to missing data

**Test Command:**
```bash
# Find a TheSports-only match
psql $DATABASE_URL -c "
SELECT m.external_id
FROM ts_matches m
LEFT JOIN integration_mappings im ON im.entity_type = 'match' AND im.ts_id = m.external_id::text
WHERE m.status_id = 1
  AND im.fs_id IS NULL
LIMIT 1;
"

# Get match ID from output, then:
MATCH_ID="<external_id from query>"

curl -s "http://localhost:3000/api/matches/${MATCH_ID}/scoring?markets=O25,BTTS&locale=tr" | jq '{
  match_id,
  footystats_linked,
  risk_flags,
  results: .results | map({
    market_id,
    probability,
    confidence,
    pick,
    can_publish,
    publish_reason
  })
}'
```

**Verification Checklist:**
- [ ] API returns 200 status
- [ ] `footystats_linked` is `false`
- [ ] Risk flags include at least `MISSING_XG`
- [ ] O25 market has `can_publish: false`
- [ ] BTTS market has `can_publish: false`
- [ ] Confidence scores are < 60 for all markets
- [ ] `publish_reason` explains why blocked (e.g., "Blocking flags present: MISSING_XG")

---

### Scenario 2: FootyStats-Linked Match

**Expected Behavior:**
- `footystats_linked: true`
- `lambda_total` present in metadata
- At least one market should be publishable (if thresholds met)
- Confidence scores > 60 for markets with sufficient data
- Risk flags minimal or empty

**Test Command:**
```bash
# Find a FootyStats-linked match
psql $DATABASE_URL -c "
SELECT m.external_id, im.fs_id
FROM ts_matches m
INNER JOIN integration_mappings im ON im.entity_type = 'match' AND im.ts_id = m.external_id::text
WHERE m.status_id = 1
  AND im.fs_id IS NOT NULL
LIMIT 1;
"

# Get match ID from output, then:
MATCH_ID="<external_id from query>"

curl -s "http://localhost:3000/api/matches/${MATCH_ID}/scoring?markets=all&locale=tr" | jq '{
  match_id,
  footystats_linked,
  risk_flags,
  lambda_total: .results[0].metadata.lambda_total,
  publishable_count: (.results | map(select(.can_publish == true)) | length),
  results: .results | map({
    market_id,
    probability,
    confidence,
    pick,
    can_publish,
    edge: (.edge // "N/A")
  })
}'
```

**Verification Checklist:**
- [ ] API returns 200 status
- [ ] `footystats_linked` is `true`
- [ ] `lambda_total` is present and > 0
- [ ] At least one market has `can_publish: true` (if lambda >= threshold)
- [ ] Confidence scores > 60 for publishable markets
- [ ] Risk flags are empty or minimal (e.g., only `MISSING_ODDS` or `MISSING_H2H`)
- [ ] Edge values calculated for markets with odds

---

### Scenario 3: Non-existent Match

**Expected Behavior:**
- API returns 404 status
- Error message: "Match not found: {match_id}"

**Test Command:**
```bash
curl -s -w "\nHTTP Status: %{http_code}\n" "http://localhost:3000/api/matches/nonexistent-id/scoring?markets=O25"
```

**Verification Checklist:**
- [ ] HTTP status is 404
- [ ] Error message includes "Match not found"

---

### Scenario 4: Invalid Market ID

**Expected Behavior:**
- API returns 400 status
- Error message: "Invalid market ID: INVALID_MARKET"

**Test Command:**
```bash
curl -s -w "\nHTTP Status: %{http_code}\n" "http://localhost:3000/api/matches/any-valid-id/scoring?markets=INVALID_MARKET"
```

**Verification Checklist:**
- [ ] HTTP status is 400
- [ ] Error message includes "Invalid market ID"

---

## Database Verification Queries

### Check FootyStats Mapping Coverage

```sql
-- Count matches with/without FootyStats links
SELECT
  CASE WHEN im.fs_id IS NOT NULL THEN 'FootyStats Linked' ELSE 'TheSports Only' END as status,
  COUNT(*) as count
FROM ts_matches m
LEFT JOIN integration_mappings im ON im.entity_type = 'match' AND im.ts_id = m.external_id::text
WHERE m.status_id = 1
GROUP BY CASE WHEN im.fs_id IS NOT NULL THEN 'FootyStats Linked' ELSE 'TheSports Only' END;
```

### Check Recent Match Coverage

```sql
-- Recent matches with linking status
SELECT
  TO_CHAR(TO_TIMESTAMP(m.match_time), 'YYYY-MM-DD') as match_date,
  COUNT(*) as total_matches,
  SUM(CASE WHEN im.fs_id IS NOT NULL THEN 1 ELSE 0 END) as linked,
  SUM(CASE WHEN im.fs_id IS NULL THEN 1 ELSE 0 END) as unlinked
FROM ts_matches m
LEFT JOIN integration_mappings im ON im.entity_type = 'match' AND im.ts_id = m.external_id::text
WHERE TO_TIMESTAMP(m.match_time) >= NOW() - INTERVAL '7 days'
  AND m.status_id IN (1, 8)
GROUP BY TO_CHAR(TO_TIMESTAMP(m.match_time), 'YYYY-MM-DD')
ORDER BY match_date DESC;
```

---

## Expected Results Summary

### TheSports-Only Match
```json
{
  "match_id": "zp5rzghg6p0eq82",
  "footystats_linked": false,
  "risk_flags": ["MISSING_XG", "MISSING_ODDS", "MISSING_POTENTIALS"],
  "results": [
    {
      "market_id": "O25",
      "probability": 0.5,
      "confidence": 45,
      "pick": "NO",
      "can_publish": false,
      "publish_reason": "❌ Failed 1 check(s): Blocking flags present: MISSING_XG"
    },
    {
      "market_id": "BTTS",
      "probability": 0.5,
      "confidence": 42,
      "pick": "NO",
      "can_publish": false,
      "publish_reason": "❌ Failed 1 check(s): Blocking flags present: MISSING_XG"
    }
  ]
}
```

### FootyStats-Linked Match (Good Case)
```json
{
  "match_id": "abc123",
  "footystats_linked": true,
  "risk_flags": [],
  "lambda_total": 2.85,
  "publishable_count": 2,
  "results": [
    {
      "market_id": "O25",
      "probability": 0.685,
      "confidence": 72,
      "pick": "YES",
      "can_publish": true,
      "edge": 0.15
    },
    {
      "market_id": "BTTS",
      "probability": 0.712,
      "confidence": 78,
      "pick": "YES",
      "can_publish": true,
      "edge": 0.08
    },
    {
      "market_id": "HT_O05",
      "probability": 0.650,
      "confidence": 68,
      "pick": "YES",
      "can_publish": true,
      "edge": 0.05
    }
  ]
}
```

---

## Post-Verification Checklist

- [ ] All API tests passed for TheSports-only match
- [ ] All API tests passed for FootyStats-linked match
- [ ] Error handling verified (404, 400)
- [ ] Database queries show expected FootyStats coverage
- [ ] Risk flags accurately reflect data completeness
- [ ] Publish eligibility rules enforced correctly
- [ ] Confidence scores align with data availability
- [ ] Edge calculation works when odds present

---

## Troubleshooting

### Issue: All matches show "TheSports Only"
**Cause:** Deterministic linking hasn't run yet
**Solution:** Wait for Week-2A deployment + first batch job run, or manually insert test mappings

### Issue: No publishable markets even with FootyStats link
**Cause:** Thresholds too strict or data quality issues
**Solution:** Check market_registry.json thresholds, verify FootyStats data completeness

### Issue: Confidence scores always low
**Cause:** Missing optional data (odds, h2h, trends)
**Solution:** Verify FootyStats API integration, check data_requirements in market_registry.json

---

**Last Updated:** 2026-01-29
**For:** Week-2A PR#5 Staging Verification

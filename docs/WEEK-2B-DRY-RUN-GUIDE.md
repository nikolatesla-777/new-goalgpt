# Week-2B Dry-Run Testing Guide

## Overview
This guide provides commands for testing the Week-2B Telegram 7-channel routing system without sending real messages to Telegram.

## DRY_RUN Mode

DRY_RUN mode allows you to test channel routing logic without actually sending messages to Telegram. This is useful for:
- Verifying channel ID mappings
- Testing routing logic
- Validating message formatting
- Smoke testing before production deployment

## Configuration

### Enable DRY_RUN Mode

Add to `.env`:
```env
TELEGRAM_PUBLISH_ENABLED=true
TELEGRAM_DRY_RUN=true
TELEGRAM_BOT_TOKEN=test-bot-token-12345

# Channel IDs (can be test IDs in dry-run mode)
TELEGRAM_CHANNEL_O25=-1001234567890
TELEGRAM_CHANNEL_BTTS=-1001234567891
TELEGRAM_CHANNEL_HT_O05=-1001234567892
TELEGRAM_CHANNEL_O35=-1001234567893
TELEGRAM_CHANNEL_HOME_O15=-1001234567894
TELEGRAM_CHANNEL_CORNERS_O85=-1001234567895
TELEGRAM_CHANNEL_CARDS_O25=-1001234567896
```

### Verify Configuration

Check channelRouter status:
```bash
curl http://localhost:3000/api/health | jq '.channelRouter'
```

Expected response:
```json
{
  "initialized": true,
  "publishEnabled": true,
  "strictConfig": true,
  "dryRun": true,
  "channelCount": 7,
  "channels": [
    {
      "market": "O25",
      "displayName": "2.5 Üst Gol",
      "configured": true,
      "chatId": "-1001234567890"
    }
    // ... (6 more channels)
  ]
}
```

## Dry-Run Tests

### Test 1: Channel Routing

Verify each market routes to correct channel:

```bash
# Test O2.5 channel
curl -X POST http://localhost:3000/api/telegram/publish \
  -H "Content-Type: application/json" \
  -d '{
    "market": "O25",
    "matchId": "test-match-123",
    "message": "Test message for O2.5 channel",
    "locale": "tr"
  }'
```

**Expected:** Log message showing routing (no actual Telegram send)
```
[ChannelRouter] DRY_RUN: Would publish O25 to -1001234567890 (2.5 Üst Gol)
```

### Test 2: All 7 Markets

Test all markets in sequence:

```bash
for market in O25 BTTS HT_O05 O35 HOME_O15 CORNERS_O85 CARDS_O25; do
  echo "Testing $market..."
  curl -X POST http://localhost:3000/api/telegram/publish \
    -H "Content-Type: application/json" \
    -d "{\"market\": \"$market\", \"matchId\": \"test-123\", \"message\": \"Test $market\"}" \
    2>/dev/null | jq '.dryRun'
  sleep 0.5
done
```

**Expected:** Each market returns `"dryRun": true`

### Test 3: Message Formatting

Test AI summary formatter with dry-run:

```bash
# Get scoring results for a match
MATCH_ID="<real-match-id>"

curl -X POST http://localhost:3000/api/telegram/publish/match-summary \
  -H "Content-Type: application/json" \
  -d "{
    \"matchId\": \"$MATCH_ID\",
    \"markets\": [\"O25\", \"BTTS\"],
    \"locale\": \"tr\"
  }" | jq '.'
```

**Expected Response:**
```json
{
  "dryRun": true,
  "markets": [
    {
      "market": "O25",
      "chatId": "-1001234567890",
      "message": "🤖 GoalGPT AI İstatistik Özeti\n\n...",
      "wouldSend": true
    },
    {
      "market": "BTTS",
      "chatId": "-1001234567891",
      "message": "🤖 GoalGPT AI İstatistik Özeti\n\n...",
      "wouldSend": true
    }
  ]
}
```

### Test 4: Error Handling

Test invalid market ID:

```bash
curl -X POST http://localhost:3000/api/telegram/publish \
  -H "Content-Type: application/json" \
  -d '{"market": "INVALID", "matchId": "test-123", "message": "Test"}' \
  | jq '.error'
```

**Expected:** `"No channel configured for market: INVALID"`

## Unit Tests

Run automated unit tests:

```bash
# Test channelRouter
npm test -- src/__tests__/channelRouter.test.ts

# Test aiSummaryFormatter
npm test -- src/__tests__/aiSummaryFormatter.test.ts

# Run both
npm test -- src/__tests__/channelRouter.test.ts src/__tests__/aiSummaryFormatter.test.ts
```

**Expected:** All 32 tests pass

## Verification Checklist

Before deploying to production:

- [ ] DRY_RUN tests pass for all 7 markets
- [ ] Channel IDs correctly mapped to environment variables
- [ ] Message formatting correct (TR/EN locales)
- [ ] Disclaimer always present in messages
- [ ] No emojis when `emojiStyle=none`
- [ ] Publishable markets filter working (only canPublish=true)
- [ ] Edge values displayed correctly
- [ ] Data-driven threshold labels (xG: High/Medium/Low)
- [ ] Unit tests pass (32/32)
- [ ] Health check endpoint returns correct status

## Production Deployment

To disable dry-run and enable real sends:

1. **Update `.env`:**
   ```env
   TELEGRAM_PUBLISH_ENABLED=true
   TELEGRAM_DRY_RUN=false
   TELEGRAM_BOT_TOKEN=<real-production-bot-token>

   # Real production channel IDs
   TELEGRAM_CHANNEL_O25=-100<real-channel-id>
   # ... (configure all 7 channels)
   ```

2. **Verify bot token:**
   ```bash
   curl "https://api.telegram.org/bot<your-token>/getMe"
   ```

3. **Verify bot is admin in all channels:**
   ```bash
   for channel in -100<channel-id-1> -100<channel-id-2> ...; do
     curl "https://api.telegram.org/bot<your-token>/getChatMember?chat_id=$channel&user_id=<bot-user-id>"
   done
   ```

4. **Restart server:**
   ```bash
   pm2 restart goalgpt
   pm2 logs goalgpt --lines 50
   ```

5. **Monitor first sends:**
   ```bash
   tail -f /var/log/goalgpt/telegram.log | grep "ChannelRouter"
   ```

## Troubleshooting

### Issue: "TELEGRAM_BOT_TOKEN is required"
**Solution:** Add bot token to `.env` or set `TELEGRAM_PUBLISH_ENABLED=false`

### Issue: "Missing channel IDs"
**Solution:** Configure all 7 channel IDs in `.env` or set `TELEGRAM_STRICT_CONFIG=false`

### Issue: DRY_RUN not working
**Solution:** Check `TELEGRAM_DRY_RUN=true` is set correctly. Restart server after `.env` changes.

### Issue: Messages not routing correctly
**Solution:** Check channelRouter status via health endpoint. Verify MarketId enum values match.

---

**Last Updated:** 2026-01-29
**For:** Week-2B PR#6 Dry-Run Testing

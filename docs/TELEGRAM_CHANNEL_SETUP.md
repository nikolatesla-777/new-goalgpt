# Telegram Channel Setup Guide - Week-2B

**Version:** 1.0.0
**Date:** 2026-01-28

This guide explains how to configure the single Telegram bot to publish predictions to 7 separate market-specific channels.

---

## Architecture Overview

**Single Bot, Multiple Channels:**
- **1 Bot Token:** `TELEGRAM_BOT_TOKEN` (shared across all channels)
- **7 Market Channels:** Each market publishes to its own channel
- **Channel Routing:** `channelRouter` service maps market IDs to chat IDs

**Benefits:**
- Easier bot management (one bot, one token)
- Users can subscribe to specific markets
- Clean channel separation (no mixed markets in one channel)
- Scalable (easy to add new markets)

---

## Prerequisites

1. **Telegram Bot:**
   - Create a bot via [@BotFather](https://t.me/BotFather)
   - Save the bot token (format: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

2. **Telegram Channels:**
   - Create 7 channels (one per market)
   - Make channels public or private
   - Add bot as admin to each channel

---

## Step 1: Create Telegram Channels

Create 7 channels with descriptive names:

| Market | Suggested Channel Name | Description |
|--------|------------------------|-------------|
| **O25** | `@goalgpt_over25` | 2.5 Üst Gol (Over 2.5 Goals) |
| **BTTS** | `@goalgpt_btts` | Karşılıklı Gol (Both Teams To Score) |
| **HT_O05** | `@goalgpt_ht_over05` | İlk Yarı 0.5 Üst (First Half Over 0.5) |
| **O35** | `@goalgpt_over35` | 3.5 Üst Gol (Over 3.5 Goals) |
| **HOME_O15** | `@goalgpt_home_over15` | Ev Sahibi 1.5 Üst (Home Team Over 1.5) |
| **CORNERS_O85** | `@goalgpt_corners` | Korner 8.5 Üst (Corners Over 8.5) |
| **CARDS_O25** | `@goalgpt_cards` | Kart 2.5 Üst (Cards Over 2.5) |

**Channel Settings:**
- **Type:** Public or Private
- **Description:** Add market-specific description
- **Link:** Optional (for public channels)

---

## Step 2: Add Bot as Admin

For **each channel**, follow these steps:

### For Public Channels:
1. Open channel settings
2. Go to **Administrators**
3. Click **Add Administrator**
4. Search for your bot's username (e.g., `@goalgpt_bot`)
5. Select bot and grant permissions:
   - ✅ Post Messages
   - ✅ Edit Messages (for settlement updates)
   - ❌ Delete Messages (not needed)
   - ❌ Pin Messages (not needed)
6. Save

### For Private Channels:
1. Open channel settings
2. Go to **Administrators**
3. Click **Add Administrator**
4. Paste bot token in Telegram search: `@goalgpt_bot`
5. If not found, invite bot via link: `https://t.me/goalgpt_bot?startchannel=true`
6. Grant same permissions as above

**⚠️ CRITICAL:** Bot MUST be admin to post messages!

---

## Step 3: Get Channel IDs

Channel IDs are required for the bot to publish messages.

### Method 1: Via @RawDataBot (Easiest)

1. Add [@RawDataBot](https://t.me/RawDataBot) to each channel
2. Send any message to the channel
3. @RawDataBot will reply with JSON containing `chat.id`
4. Copy the `chat.id` value (e.g., `-1001234567890`)
5. Remove @RawDataBot from channel

**Example Response:**
```json
{
  "update_id": 123456789,
  "channel_post": {
    "chat": {
      "id": -1001234567890,
      "title": "GoalGPT Over 2.5",
      "type": "channel"
    }
  }
}
```

### Method 2: Via @userinfobot

1. Forward any message from the channel to [@userinfobot](https://t.me/userinfobot)
2. Bot will reply with channel ID
3. Copy the ID

### Method 3: Via Telegram API (Advanced)

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates"
```

Look for `"chat":{"id":-100...}` in the response.

---

## Step 4: Configure Environment Variables

Update `.env` file with bot token and channel IDs:

```bash
# Telegram Bot Token (single bot for all channels)
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# Dry-run mode (set to 'true' for testing without sending to Telegram)
TELEGRAM_DRY_RUN=false

# Market-specific channels
TELEGRAM_CHANNEL_O25=-1001234567890        # 2.5 Üst Gol
TELEGRAM_CHANNEL_BTTS=-1001234567891       # Karşılıklı Gol (BTTS)
TELEGRAM_CHANNEL_HT_O05=-1001234567892     # İlk Yarı 0.5 Üst
TELEGRAM_CHANNEL_O35=-1001234567893        # 3.5 Üst Gol
TELEGRAM_CHANNEL_HOME_O15=-1001234567894   # Ev Sahibi 1.5 Üst
TELEGRAM_CHANNEL_CORNERS_O85=-1001234567895 # Korner 8.5 Üst
TELEGRAM_CHANNEL_CARDS_O25=-1001234567896  # Kart 2.5 Üst
```

**Channel ID Format:**
- **Public channels:** `-100` prefix + numeric ID (e.g., `-1001234567890`)
- **Private channels:** Same format as public
- **Username channels:** `@channel_name` (works but numeric ID is preferred)

---

## Step 5: Test Configuration

### 5.1 Dry-Run Mode (Recommended First)

Set `TELEGRAM_DRY_RUN=true` in `.env` and restart server:

```bash
TELEGRAM_DRY_RUN=true npm start
```

**Expected Logs:**
```
✅ Telegram channel router initialized
⚠️  DRY_RUN mode enabled - messages will NOT be sent to Telegram
```

Trigger daily lists job:
```bash
curl -X POST http://localhost:3000/api/telegram/publish/daily-lists
```

**Check Logs:**
```
[ChannelRouter] DRY_RUN: Would publish O25 to -1001234567890
[ChannelRouter] DRY_RUN: Would publish BTTS to -1001234567891
...
```

No messages sent to Telegram, but routing logic is validated.

### 5.2 Production Test (Single Channel)

1. Set `TELEGRAM_DRY_RUN=false`
2. Test single market endpoint:

```bash
curl -X POST http://localhost:3000/api/telegram/publish/daily-list/OVER_25
```

**Expected Response:**
```json
{
  "success": true,
  "market": "OVER_25",
  "telegram_message_id": 1234,
  "match_count": 5,
  "avg_confidence": 72
}
```

3. Check `@goalgpt_over25` channel for published message
4. Repeat for other markets

### 5.3 Full Production Test

Publish all daily lists:

```bash
curl -X POST http://localhost:3000/api/telegram/publish/daily-lists
```

**Expected Response:**
```json
{
  "success": true,
  "lists_generated": 7,
  "lists_published": 7,
  "published_lists": [
    { "market": "OVER_25", "telegram_message_id": 1234 },
    { "market": "BTTS", "telegram_message_id": 1235 },
    ...
  ]
}
```

---

## Troubleshooting

### Error: "Missing Telegram channel IDs"

**Cause:** One or more `TELEGRAM_CHANNEL_*` variables not set in `.env`

**Solution:**
1. Check `.env` file for missing variables
2. Ensure all 7 channels are configured
3. Or set `TELEGRAM_DRY_RUN=true` to bypass validation

---

### Error: "Telegram API returned ok=false"

**Cause:** Bot not admin or channel ID incorrect

**Solution:**
1. Verify bot is admin in channel (Settings → Administrators)
2. Check channel ID format (must start with `-100`)
3. Use @RawDataBot to confirm correct channel ID

---

### Error: "Bot was blocked by the user"

**Cause:** Bot removed from channel

**Solution:**
1. Re-add bot to channel as admin
2. Restart server to clear cached state

---

### No messages sent (dry-run mode)

**Cause:** `TELEGRAM_DRY_RUN=true` is set

**Solution:**
- Set `TELEGRAM_DRY_RUN=false` in `.env`
- Restart server

---

### Wrong channel receives messages

**Cause:** Channel ID misconfiguration

**Solution:**
1. Verify each `TELEGRAM_CHANNEL_*` variable matches correct channel
2. Use @RawDataBot to double-check channel IDs
3. Restart server after `.env` changes

---

## Channel Router API

### Get Router Status

```bash
curl http://localhost:3000/api/telegram/health
```

**Response:**
```json
{
  "configured": true,
  "metrics": { "requests": 42, "errors": 0 },
  "router_status": {
    "initialized": true,
    "dryRun": false,
    "channelCount": 7,
    "channels": [
      {
        "market": "O25",
        "displayName": "2.5 Üst Gol",
        "configured": true,
        "chatId": "***"
      },
      ...
    ]
  }
}
```

---

## Security Best Practices

1. **Never commit `.env` to git:** Add `.env` to `.gitignore`
2. **Keep bot token secret:** Rotate if exposed
3. **Use private channels:** For sensitive predictions
4. **Limit bot permissions:** Only grant necessary permissions
5. **Monitor unauthorized access:** Check Telegram bot logs regularly

---

## Maintenance

### Adding a New Market

1. Create new Telegram channel
2. Add bot as admin
3. Get channel ID
4. Add to `.env`:
   ```bash
   TELEGRAM_CHANNEL_NEW_MARKET=-1001234567897
   ```
5. Update `channelRouter.ts` to include new market
6. Restart server

### Changing Channel IDs

1. Update `.env` with new channel IDs
2. Restart server
3. Test with dry-run mode first
4. Verify messages go to correct channels

---

## FAQ

**Q: Can I use the same channel for multiple markets?**
A: Yes, but not recommended. Set the same channel ID for multiple `TELEGRAM_CHANNEL_*` variables.

**Q: Can I use channel usernames instead of IDs?**
A: Yes (e.g., `@goalgpt_over25`), but numeric IDs are more reliable.

**Q: What happens if a channel ID is missing?**
A: Server will fail to start (unless `TELEGRAM_DRY_RUN=true`).

**Q: Can I test without creating 7 channels?**
A: Yes, use `TELEGRAM_DRY_RUN=true` to test routing logic without actual sends.

**Q: How do I know if bot is admin in a channel?**
A: Check channel Settings → Administrators. Bot username should appear there.

---

**Last Updated:** 2026-01-28
**Version:** 1.0.0

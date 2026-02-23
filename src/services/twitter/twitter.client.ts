/**
 * TwitterClient - Singleton Pattern
 *
 * Twitter/X API v2 client for publishing trend threads.
 * Follows the same pattern as telegram.client.ts:
 * - Singleton instance
 * - DRY_RUN support (no real tweets sent)
 * - Kill switch check
 * - Rate limiter (1s between tweets)
 * - Health endpoint
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */

import { TwitterApi } from 'twitter-api-v2';
import { logger } from '../../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface TwitterHealthStatus {
  configured: boolean;
  dry_run: boolean;
  kill_switch: boolean;
  publish_enabled: boolean;
  metrics: {
    requests: number;
    errors: number;
  };
}

export interface PostThreadResult {
  success: boolean;
  dry_run: boolean;
  tweet_ids?: string[];
  main_tweet_id?: string;
  tweets_posted?: number;
  error?: string;
}

export interface MediaUploadResult {
  success: boolean;
  mediaId?: string;
  error?: string;
}

// ============================================================================
// SINGLETON CLIENT
// ============================================================================

class TwitterClient {
  private static instance: TwitterClient | null = null;
  private client: TwitterApi | null = null;
  private requestCount = 0;
  private errorCount = 0;

  private constructor() {
    const apiKey = process.env.TWITTER_API_KEY;
    const apiSecret = process.env.TWITTER_API_SECRET;
    const accessToken = process.env.TWITTER_ACCESS_TOKEN;
    const accessSecret = process.env.TWITTER_ACCESS_SECRET;

    const isDryRun = process.env.TWITTER_DRY_RUN === 'true';

    if (!isDryRun && apiKey && apiSecret && accessToken && accessSecret) {
      this.client = new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
        accessToken: accessToken,
        accessSecret: accessSecret,
      });
      logger.info('[Twitter] Client initialized with OAuth 1.0a credentials');
    } else if (!isDryRun) {
      const strict = process.env.TWITTER_STRICT_CONFIG === 'true';
      const msg = '[Twitter] Credentials not configured (TWITTER_API_KEY/SECRET/ACCESS_TOKEN/SECRET missing)';
      if (strict) {
        logger.warn(`${msg} — strict mode: will reject publish calls`);
      } else {
        logger.warn(`${msg} — non-strict: will operate in dry-run fallback`);
      }
    } else {
      logger.info('[Twitter] DRY_RUN mode — no real tweets will be sent');
    }
  }

  static getInstance(): TwitterClient {
    if (!TwitterClient.instance) {
      TwitterClient.instance = new TwitterClient();
    }
    return TwitterClient.instance;
  }

  /**
   * Upload a PNG image (as base64 string) to Twitter via the v1.1 media upload API.
   * Returns the media_id string to attach to a tweet.
   */
  async uploadMedia(imageBase64: string): Promise<MediaUploadResult> {
    if (process.env.TWITTER_DRY_RUN === 'true') {
      logger.info('[Twitter] DRY_RUN: Would upload media image');
      return { success: true, mediaId: 'dry_run_media_id' };
    }

    if (!this.client) {
      return { success: false, error: 'CLIENT_NOT_INITIALIZED' };
    }

    try {
      const buffer = Buffer.from(imageBase64, 'base64');
      const mediaId = await this.client.v1.uploadMedia(buffer, { mimeType: 'image/png' });
      logger.info(`[Twitter] Media uploaded successfully: ${mediaId}`);
      return { success: true, mediaId };
    } catch (err: any) {
      logger.error('[Twitter] Media upload failed:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Post a tweet thread (reply chain)
   * First tweet is the root; each subsequent tweet replies to the previous.
   * mediaIds: optional media to attach to the FIRST tweet only.
   *
   * DRY_RUN: Logs tweets but does not send.
   * Kill switch: Aborts immediately.
   */
  async postThread(tweets: string[], mediaIds?: string[]): Promise<PostThreadResult> {
    // Kill switch
    if (process.env.TWITTER_KILL_SWITCH === 'true') {
      logger.warn('[Twitter] ⛔ Kill switch active (TWITTER_KILL_SWITCH=true). Aborting thread post.');
      return { success: false, dry_run: false, error: 'KILL_SWITCH_ACTIVE' };
    }

    const isDryRun = process.env.TWITTER_DRY_RUN === 'true';

    // DRY_RUN: just log
    if (isDryRun) {
      logger.info(`[Twitter] 🧪 DRY_RUN: Would post thread with ${tweets.length} tweets${mediaIds?.length ? ` + ${mediaIds.length} media` : ''}:`);
      tweets.forEach((t, i) => {
        logger.info(`[Twitter] DRY_RUN tweet[${i}] (${t.length} chars): ${t.substring(0, 100)}...`);
      });
      return {
        success: true,
        dry_run: true,
        tweet_ids: tweets.map((_, i) => `dry_run_tweet_${i}`),
        main_tweet_id: 'dry_run_tweet_0',
      };
    }

    if (!this.client) {
      logger.error('[Twitter] Client not initialized — cannot post thread');
      return { success: false, dry_run: false, error: 'CLIENT_NOT_INITIALIZED' };
    }

    const TWEET_DELAY_MS = 1000; // 1s between tweets to avoid rate limiting
    const tweetIds: string[] = [];
    let replyToId: string | undefined;

    try {
      for (let i = 0; i < tweets.length; i++) {
        this.requestCount++;

        const tweetText = tweets[i];
        let response: any;

        logger.info(`[Twitter] 📝 Posting tweet ${i + 1}/${tweets.length}`, {
          index: i,
          length: tweetText.length,
          preview: tweetText.substring(0, 80).replace(/\n/g, '\\n'),
        });

        if (i === 0) {
          // Root tweet — attach media if provided
          const tweetPayload: any = { text: tweetText };
          if (mediaIds && mediaIds.length > 0) {
            tweetPayload.media = { media_ids: mediaIds };
          }
          response = await this.client.v2.tweet(tweetPayload);
        } else {
          // Reply to previous tweet
          response = await this.client.v2.reply(tweetText, replyToId!);
        }

        const tweetId = response.data.id;
        tweetIds.push(tweetId);
        replyToId = tweetId;

        logger.info(`[Twitter] ✅ Tweet ${i + 1}/${tweets.length} posted: ${tweetId}`);

        // Rate limiter: wait 1s between tweets
        if (i < tweets.length - 1) {
          await new Promise(resolve => setTimeout(resolve, TWEET_DELAY_MS));
        }
      }

      return {
        success: true,
        dry_run: false,
        tweet_ids: tweetIds,
        main_tweet_id: tweetIds[0],
      };
    } catch (err: any) {
      this.errorCount++;
      const httpCode = err.code ?? err.status ?? err.statusCode;
      logger.error('[Twitter] ❌ Failed to post thread:', {
        error: err.message,
        http_code: httpCode,
        twitter_errors: err.data?.errors ?? err.errors,
        tweets_posted: tweetIds.length,
        total_tweets: tweets.length,
      });

      // 429: Daily/rate limit — show exact reset time
      if (httpCode === 429) {
        const rl = err.rateLimit;
        // Prefer day-level reset, fall back to general reset
        const resetTs = rl?.day?.reset ?? rl?.userDay?.reset ?? rl?.reset;
        const dailyRemaining = rl?.day?.remaining ?? rl?.userDay?.remaining;
        const dailyLimit = rl?.day?.limit ?? rl?.userDay?.limit;
        let msg = 'Twitter günlük tweet limitine ulaşıldı';
        if (dailyLimit) msg += ` (${dailyLimit} tweet/gün)`;
        msg += '.';
        if (resetTs) {
          const resetDate = new Date(resetTs * 1000);
          msg += ` Gece yarısı UTC'de (${resetDate.toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' })} TR) sıfırlanacak.`;
        } else {
          msg += ' Yarın tekrar deneyin.';
        }
        logger.warn('[Twitter] 429 rate limit detail:', { dailyLimit, dailyRemaining, resetTs });
        return { success: false, dry_run: false, tweets_posted: tweetIds.length, error: msg };
      }

      return {
        success: false,
        dry_run: false,
        tweets_posted: tweetIds.length,
        error: err.message,
      };
    }
  }

  /**
   * Check if client is configured with real credentials
   */
  isConfigured(): boolean {
    const isDryRun = process.env.TWITTER_DRY_RUN === 'true';
    return isDryRun || this.client !== null;
  }

  /**
   * Get health status for /api/twitter/health endpoint
   */
  getHealth(): TwitterHealthStatus {
    return {
      configured: this.isConfigured(),
      dry_run: process.env.TWITTER_DRY_RUN === 'true',
      kill_switch: process.env.TWITTER_KILL_SWITCH === 'true',
      publish_enabled: process.env.TWITTER_PUBLISH_ENABLED === 'true',
      metrics: {
        requests: this.requestCount,
        errors: this.errorCount,
      },
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const twitterClient = TwitterClient.getInstance();
export { TwitterClient };

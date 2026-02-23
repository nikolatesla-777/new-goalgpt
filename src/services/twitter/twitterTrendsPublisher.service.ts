/**
 * Twitter Trends Publisher Service
 *
 * Orchestrates the full publish flow:
 * 1. Kill switch + feature flag check
 * 2. Idempotency (same-day dedupe)
 * 3. Fetch trends data from FootyStats endpoint
 * 4. Format tweet thread
 * 5. Create DRAFT DB record
 * 6. Post thread via TwitterClient
 * 7. Update DB to PUBLISHED or FAILED
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */

import crypto from 'crypto';
import axios from 'axios';
import { pool } from '../../database/connection';
import { logger } from '../../utils/logger';
import { twitterClient } from './twitter.client';
import { formatTrendsThread, TrendsInput } from './twitter.formatter';

const TEMPLATE_VERSION = 'v1';

// ============================================================================
// TYPES
// ============================================================================

export interface PublishTrendsResult {
  success: boolean;
  dry_run?: boolean;
  skipped?: boolean;
  skip_reason?: string;
  tweet_count?: number;
  tweets_posted?: number;
  main_tweet_id?: string;
  tweet_ids?: string[];
  post_id?: string;
  error?: string;
  elapsed_ms?: number;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate daily dedupe key: SHA256('twitter:trends:YYYY-MM-DD:v1')
 */
function generateDedupeKey(date: Date): string {
  const dateStr = date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' }); // YYYY-MM-DD
  const input = `twitter:trends:${dateStr}:${TEMPLATE_VERSION}`;
  return crypto.createHash('sha256').update(input).digest('hex').substring(0, 64);
}

/**
 * Check if today's trends were already published (idempotency)
 */
async function checkAlreadyPublished(dedupeKey: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id FROM twitter_posts WHERE dedupe_key = $1 AND status = 'published' LIMIT 1`,
      [dedupeKey]
    );
    return result.rows.length > 0;
  } finally {
    client.release();
  }
}

/**
 * Create DRAFT record in DB (idempotent — ON CONFLICT DO NOTHING)
 * Returns new post id or null if conflict
 */
async function createDraftRecord(params: {
  dedupeKey: string;
  tweets: string[];
  isDryRun: boolean;
  trendsSnapshot: any;
}): Promise<string | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO twitter_posts
         (dedupe_key, main_tweet_text, thread_tweets, dry_run, template_version, trends_snapshot, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'draft')
       ON CONFLICT (dedupe_key) DO UPDATE SET
         main_tweet_text  = EXCLUDED.main_tweet_text,
         thread_tweets    = EXCLUDED.thread_tweets,
         trends_snapshot  = EXCLUDED.trends_snapshot,
         status           = 'draft',
         retry_count      = twitter_posts.retry_count + 1
       WHERE twitter_posts.status = 'failed'
       RETURNING id`,
      [
        params.dedupeKey,
        params.tweets[0],
        JSON.stringify(params.tweets),
        params.isDryRun,
        TEMPLATE_VERSION,
        JSON.stringify(params.trendsSnapshot),
      ]
    );
    return result.rows[0]?.id || null;
  } finally {
    client.release();
  }
}

/**
 * Mark post as PUBLISHED
 */
async function markPublished(postId: string, mainTweetId: string, tweetIds: string[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE twitter_posts
       SET status = 'published',
           main_tweet_id = $2,
           thread_tweet_ids = $3,
           posted_at = NOW()
       WHERE id = $1`,
      [postId, mainTweetId, JSON.stringify(tweetIds)]
    );
  } finally {
    client.release();
  }
}

/**
 * Mark post as FAILED
 */
async function markFailed(postId: string, errorMessage: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE twitter_posts
       SET status = 'failed',
           error_log = $2,
           last_error_at = NOW(),
           retry_count = retry_count + 1
       WHERE id = $1`,
      [postId, errorMessage]
    );
  } finally {
    client.release();
  }
}

/**
 * Fetch trends data from the internal FootyStats endpoint
 */
export async function fetchTrendsData(): Promise<TrendsInput> {
  const baseUrl = process.env.INTERNAL_API_URL || 'http://localhost:3000';
  const response = await axios.get(`${baseUrl}/api/footystats/trends-analysis`, {
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.data?.success) {
    throw new Error(`Trends API returned success=false: ${JSON.stringify(response.data)}`);
  }

  const trends = response.data.trends || {};
  return {
    goalTrends: trends.goalTrends || [],
    formTrends: trends.formTrends || [],
    cornerTrends: trends.cornerTrends || [],
    cardsTrends: trends.cardsTrends || [],
    totalMatches: response.data.totalMatches || 0,
  };
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function publishTrendsToTwitter(): Promise<PublishTrendsResult> {
  const startTime = Date.now();
  logger.info('[TwitterTrends] 🚀 Starting trends publish...');

  // 1. Kill switch
  if (process.env.TWITTER_KILL_SWITCH === 'true') {
    logger.warn('[TwitterTrends] ⛔ Kill switch active — aborting.');
    return { success: true, skipped: true, skip_reason: 'KILL_SWITCH_ACTIVE' };
  }

  // 2. Feature flag check
  const isDryRun = process.env.TWITTER_DRY_RUN === 'true';
  const isEnabled = process.env.TWITTER_PUBLISH_ENABLED === 'true';

  if (!isEnabled && !isDryRun) {
    logger.info('[TwitterTrends] ⏸️ Publishing disabled (TWITTER_PUBLISH_ENABLED=false, TWITTER_DRY_RUN=false)');
    return { success: true, skipped: true, skip_reason: 'PUBLISH_DISABLED' };
  }

  try {
    // 3. Idempotency check
    const dedupeKey = generateDedupeKey(new Date());

    if (!isDryRun) {
      const alreadyPublished = await checkAlreadyPublished(dedupeKey);
      if (alreadyPublished) {
        logger.info('[TwitterTrends] ⏭️ Already published today — skipping.', { dedupe_key: dedupeKey });
        return { success: true, skipped: true, skip_reason: 'ALREADY_PUBLISHED_TODAY' };
      }
    }

    // 4. Fetch trends data
    logger.info('[TwitterTrends] 📊 Fetching trends data...');
    const trendsInput = await fetchTrendsData();
    logger.info('[TwitterTrends] ✅ Trends fetched', {
      goal_trends: trendsInput.goalTrends.length,
      form_trends: trendsInput.formTrends.length,
      corner_trends: trendsInput.cornerTrends.length,
      cards_trends: trendsInput.cardsTrends.length,
      total_matches: trendsInput.totalMatches,
    });

    // 5. Format tweets
    const tweets = formatTrendsThread(trendsInput);
    logger.info('[TwitterTrends] ✅ Thread formatted', { tweet_count: tweets.length });

    // Validate tweet lengths
    for (let i = 0; i < tweets.length; i++) {
      if (tweets[i].length > 280) {
        logger.error(`[TwitterTrends] ❌ Tweet ${i} exceeds 280 chars: ${tweets[i].length}`);
        throw new Error(`Tweet ${i} exceeds 280 characters (${tweets[i].length})`);
      }
    }

    // 6. Create DRAFT in DB (skip DB for dry-run)
    let postId: string | null = null;
    if (!isDryRun) {
      postId = await createDraftRecord({
        dedupeKey,
        tweets,
        isDryRun,
        trendsSnapshot: trendsInput,
      });

      if (!postId) {
        // Race condition — another instance already inserted
        logger.warn('[TwitterTrends] ⚠️ Race condition on DB insert — another instance won. Skipping.');
        return { success: true, skipped: true, skip_reason: 'RACE_CONDITION_DUPLICATE' };
      }
      logger.info('[TwitterTrends] ✅ DRAFT record created', { post_id: postId });
    }

    // 7. Post the thread
    logger.info('[TwitterTrends] 📡 Posting thread...', { dry_run: isDryRun });
    const result = await twitterClient.postThread(tweets);

    if (!result.success) {
      const errMsg = result.error || 'Unknown error';
      logger.error('[TwitterTrends] ❌ Thread post failed', {
        error: errMsg,
        tweets_posted: result.tweets_posted,
        tweet_count: tweets.length,
      });
      if (postId) {
        await markFailed(postId, errMsg);
      }
      return {
        success: false,
        tweets_posted: result.tweets_posted,
        tweet_count: tweets.length,
        error: errMsg,
        elapsed_ms: Date.now() - startTime,
      };
    }

    // 8. Mark as PUBLISHED
    if (!isDryRun && postId && result.main_tweet_id) {
      await markPublished(postId, result.main_tweet_id, result.tweet_ids || []);
    }

    const elapsed = Date.now() - startTime;
    logger.info('[TwitterTrends] ✅ Published successfully', {
      dry_run: isDryRun,
      tweet_count: tweets.length,
      main_tweet_id: result.main_tweet_id,
      elapsed_ms: elapsed,
    });

    return {
      success: true,
      dry_run: isDryRun,
      tweet_count: tweets.length,
      main_tweet_id: result.main_tweet_id,
      tweet_ids: result.tweet_ids,
      post_id: postId || undefined,
      elapsed_ms: elapsed,
    };

  } catch (err: any) {
    const elapsed = Date.now() - startTime;
    logger.error('[TwitterTrends] ❌ Publish error', {
      error: err.message,
      stack: err.stack,
      elapsed_ms: elapsed,
    });
    return {
      success: false,
      error: err.message,
      elapsed_ms: elapsed,
    };
  }
}

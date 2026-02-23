/**
 * Twitter Publish Routes
 *
 * POST /twitter/publish/trends  → Publish today's trends thread
 * GET  /twitter/health          → Client health status
 */

import { FastifyInstance } from 'fastify';
import { twitterClient } from '../../services/twitter/twitter.client';
import { publishTrendsToTwitter, fetchTrendsData } from '../../services/twitter/twitterTrendsPublisher.service';
import { formatTrendsThread } from '../../services/twitter/twitter.formatter';
import { logger } from '../../utils/logger';

export async function twitterPublishRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /twitter/health
   * Returns Twitter client health status
   */
  fastify.get('/twitter/health', async (_request, _reply) => {
    return twitterClient.getHealth();
  });

  /**
   * GET /twitter/debug/format
   * Returns the formatted tweet thread WITHOUT posting — for inspection/debugging.
   */
  fastify.get('/twitter/debug/format', async (_request, reply) => {
    try {
      const trendsInput = await fetchTrendsData();
      const tweets = formatTrendsThread(trendsInput);
      return {
        success: true,
        tweet_count: tweets.length,
        tweets: tweets.map((text, i) => ({
          index: i,
          length: text.length,
          text,
        })),
        trends_summary: {
          goalTrends: trendsInput.goalTrends.length,
          formTrends: trendsInput.formTrends.length,
          cornerTrends: trendsInput.cornerTrends.length,
          cardsTrends: trendsInput.cardsTrends.length,
          totalMatches: trendsInput.totalMatches,
        },
      };
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  /**
   * POST /twitter/publish/trends
   * Publish today's trends as a Twitter thread
   *
   * Respects kill switch, idempotency, DRY_RUN mode.
   */
  fastify.post('/twitter/publish/trends', async (_request, reply) => {
    logger.info('[Twitter.Route] POST /twitter/publish/trends triggered');

    try {
      const result = await publishTrendsToTwitter();

      if (!result.success && !result.skipped) {
        return reply.status(500).send(result);
      }

      return result;
    } catch (err: any) {
      logger.error('[Twitter.Route] Unexpected error in publish/trends:', err);
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  /**
   * POST /twitter/publish/single-match
   * Publish a single manually edited tweet for a specific match.
   *
   * Body: { text: string, imageBase64?: string, replyText?: string }
   *   - text: main tweet text (max 280 chars)
   *   - imageBase64: optional PNG as base64 (no data: prefix)
   *   - replyText: optional reply tweet text (max 280 chars) — posted as thread reply
   */
  fastify.post<{ Body: { text: string; imageBase64?: string; replyText?: string } }>('/twitter/publish/single-match', async (request, reply) => {
    const { text, imageBase64, replyText } = request.body ?? {};

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return reply.status(400).send({ success: false, error: 'text is required' });
    }

    if (text.length > 280) {
      return reply.status(400).send({ success: false, error: 'Tweet 280 karakteri geçemez' });
    }

    if (replyText && replyText.length > 280) {
      return reply.status(400).send({ success: false, error: 'Yanıt tweet 280 karakteri geçemez' });
    }

    logger.info('[Twitter.Route] POST /twitter/publish/single-match', {
      length: text.length,
      hasImage: !!imageBase64,
      hasReply: !!replyText,
      preview: text.substring(0, 60).replace(/\n/g, '\\n'),
    });

    try {
      // Upload image if provided
      let mediaId: string | undefined;
      if (imageBase64 && typeof imageBase64 === 'string' && imageBase64.length > 0) {
        const uploadResult = await twitterClient.uploadMedia(imageBase64);
        if (uploadResult.success && uploadResult.mediaId) {
          mediaId = uploadResult.mediaId;
          logger.info('[Twitter.Route] Media uploaded:', { mediaId });
        } else {
          logger.warn('[Twitter.Route] Media upload failed, posting without image:', uploadResult.error);
        }
      }

      // Build thread: main tweet + optional reply
      const tweets = [text.trim()];
      if (replyText && replyText.trim().length > 0) {
        tweets.push(replyText.trim());
      }

      const result = await twitterClient.postThread(tweets, mediaId ? [mediaId] : undefined);

      if (!result.success) {
        return reply.status(500).send({ success: false, error: result.error ?? 'Tweet gönderilemedi' });
      }

      return {
        success: true,
        dry_run: result.dry_run,
        tweet_id: result.main_tweet_id,
        reply_tweet_id: tweets.length > 1 ? result.tweet_ids?.[1] : undefined,
        has_media: !!mediaId,
        thread_length: tweets.length,
      };
    } catch (err: any) {
      logger.error('[Twitter.Route] single-match error:', err);
      return reply.status(500).send({ success: false, error: err.message });
    }
  });
}

/**
 * Telegram Routes - Main Entry Point
 *
 * Combines all telegram route modules into a single export
 */

import { FastifyInstance } from 'fastify';
import { publishRoutes } from './publish.routes';
import { dailyListsRoutes } from './dailyLists.routes';
import { telegramWebhookRoutes } from '../telegram.webhook';

/**
 * Register all telegram routes
 *
 * @param fastify - Fastify instance
 */
export async function telegramRoutes(fastify: FastifyInstance): Promise<void> {
  // Register publish routes (match publishing, health checks)
  await publishRoutes(fastify);

  // Register daily lists routes (list generation, publishing)
  await dailyListsRoutes(fastify);

  // Register webhook routes (bot interactions with users)
  await telegramWebhookRoutes(fastify);
}

/**
 * Telegram Routes - Main Entry Point
 *
 * Combines all telegram route modules into a single export
 */

import { FastifyInstance } from 'fastify';
import { publishRoutes } from './publish.routes';
import { dailyListsRoutes } from './dailyLists.routes';

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
}

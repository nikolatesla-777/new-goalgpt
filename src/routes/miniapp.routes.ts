/**
 * Telegram Mini App Routes
 * 
 * Serves the Mini App HTML
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { readFileSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';

export async function miniAppRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /miniapp
   * Serve Telegram Mini App
   */
  fastify.get('/miniapp', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const htmlPath = join(__dirname, '../../telegram-miniapp/index.html');
      const html = readFileSync(htmlPath, 'utf-8');
      
      reply.type('text/html').send(html);
    } catch (error: any) {
      logger.error('[MiniApp] Error serving mini app:', error);
      return reply.status(500).send({ error: 'Failed to load mini app' });
    }
  });
}

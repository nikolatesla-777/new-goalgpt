/**
 * Twitter Routes - Main Entry Point
 */

import { FastifyInstance } from 'fastify';
import { twitterPublishRoutes } from './publish.routes';

export async function twitterRoutes(fastify: FastifyInstance): Promise<void> {
  await twitterPublishRoutes(fastify);
}

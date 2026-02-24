import { FastifyInstance } from 'fastify';
import { postInstagramStory } from '../../services/instagram/instagram.client';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export async function instagramRoutes(app: FastifyInstance) {
  // POST /api/instagram/story — Post match card as Instagram Story
  app.post<{ Body: { image_base64: string } }>(
    '/api/instagram/story',
    async (req, reply) => {
      const { image_base64 } = req.body;
      if (!image_base64) {
        return reply.code(400).send({ success: false, error: 'image_base64 required' });
      }
      const result = await postInstagramStory(image_base64);
      return reply.send(result);
    }
  );

  // GET /api/stories/:filename — Serve temp story images for Instagram API
  app.get<{ Params: { filename: string } }>(
    '/api/stories/:filename',
    async (req, reply) => {
      const { filename } = req.params;
      // Security: only allow our generated filenames
      if (!/^story-\d+\.png$/.test(filename)) {
        return reply.code(403).send('Forbidden');
      }
      const filepath = path.join(os.tmpdir(), 'goalgpt-stories', filename);
      if (!fs.existsSync(filepath)) {
        return reply.code(404).send('Not found');
      }
      const stream = fs.createReadStream(filepath);
      return reply.type('image/png').send(stream);
    }
  );
}

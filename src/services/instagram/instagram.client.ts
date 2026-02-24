import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from '../../utils/logger';

const IG_USER_ID = process.env.INSTAGRAM_USER_ID || '';
const IG_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN || '';
const IG_API_BASE = 'https://graph.instagram.com/v21.0';

export async function postInstagramStory(imageBase64: string): Promise<{
  success: boolean;
  story_id?: string;
  error?: string;
  dry_run?: boolean;
}> {
  if (!IG_USER_ID || !IG_ACCESS_TOKEN) {
    return { success: false, error: 'Instagram credentials not configured' };
  }

  if (process.env.INSTAGRAM_DRY_RUN === 'true') {
    logger.info('[Instagram] DRY_RUN — story would be posted');
    return { success: true, dry_run: true, story_id: 'dry_run_id' };
  }

  if (process.env.INSTAGRAM_STORY_ENABLED !== 'true') {
    return { success: false, error: 'Instagram story publishing is disabled' };
  }

  try {
    // 1. Save base64 image to temp file on server
    const tmpDir = path.join(os.tmpdir(), 'goalgpt-stories');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const filename = `story-${Date.now()}.png`;
    const filepath = path.join(tmpDir, filename);
    const buffer = Buffer.from(imageBase64, 'base64');
    fs.writeFileSync(filepath, buffer);

    // 2. Build public URL (served via /api/stories/:filename)
    const serverBase = process.env.SERVER_BASE_URL || 'https://partnergoalgpt.com';
    const imageUrl = `${serverBase}/api/stories/${filename}`;

    logger.info(`[Instagram] Posting story with image: ${imageUrl}`);

    // 3. Create media container (story)
    // Try media_type=STORIES (new Instagram Business API approach)
    const formParams = new URLSearchParams();
    formParams.append('image_url', imageUrl);
    formParams.append('media_type', 'STORIES');
    formParams.append('access_token', IG_ACCESS_TOKEN);

    logger.info('[Instagram] Request params: ' + formParams.toString().replace(IG_ACCESS_TOKEN, '***'));

    const containerRes = await fetch(
      `${IG_API_BASE}/${IG_USER_ID}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formParams.toString(),
      }
    );

    const containerData = await containerRes.json() as any;
    logger.info('[Instagram] Container response: ' + JSON.stringify(containerData));

    if (!containerData.id) {
      fs.unlinkSync(filepath);
      return { success: false, error: containerData.error?.message || 'Container creation failed' };
    }

    // 4. Wait 2 seconds then publish
    await new Promise(r => setTimeout(r, 2000));

    const publishRes = await fetch(
      `${IG_API_BASE}/${IG_USER_ID}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerData.id,
          access_token: IG_ACCESS_TOKEN,
        }),
      }
    );

    const publishData = await publishRes.json() as any;
    logger.info('[Instagram] Publish response: ' + JSON.stringify(publishData));

    // 5. Clean up temp file after 1 hour
    setTimeout(() => {
      try { fs.unlinkSync(filepath); } catch {}
    }, 3600 * 1000);

    if (publishData.id) {
      return { success: true, story_id: publishData.id };
    } else {
      return { success: false, error: publishData.error?.message || 'Publish failed' };
    }

  } catch (err: any) {
    logger.error('[Instagram] Error posting story:', err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}

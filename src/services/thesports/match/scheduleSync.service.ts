
/**
 * Schedule Sync Service
 * 
 * Handles daily bulk sync - fetches all matches for a specific date
 */

import { theSportsAPI } from '../../../core/TheSportsAPIManager';
import { logger } from '../../../utils/logger';
import { MatchDiaryResponse, MatchDiaryParams } from '../../../types/thesports/match';
import { withSyncLock, SyncType } from '../sync/sync-strategy';
import { formatTheSportsDate } from '../../../utils/thesports/timestamp.util';

export class ScheduleSyncService {
    private client = theSportsAPI;

  constructor() {}

  /**
   * Daily bulk sync: Fetch all matches for a specific date
   */
  async syncDaily(date?: Date): Promise<MatchDiaryResponse> {
    return withSyncLock(SyncType.SCHEDULE, async () => {
      const syncDate = date || new Date();
      const dateString = formatTheSportsDate(syncDate);

      logger.info(`Daily sync started for date: ${dateString}`);

      const response = await this.client.get<MatchDiaryResponse>(
        '/match/diary',
        { date: dateString }
      );

      logger.info(`Daily sync completed: ${response.results.length} matches`);

      return response;
    });
  }

  /**
   * Sync multiple dates (for historical data)
   */
  async syncDateRange(startDate: Date, endDate: Date): Promise<MatchDiaryResponse[]> {
    const results: MatchDiaryResponse[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      try {
        const result = await this.syncDaily(new Date(currentDate));
        results.push(result);
      } catch (error: any) {
        logger.error(`Failed to sync date ${formatTheSportsDate(currentDate)}:`, error);
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return results;
  }
}


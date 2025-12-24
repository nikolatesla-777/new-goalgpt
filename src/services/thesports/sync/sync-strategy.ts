/**
 * Sync Strategy
 * 
 * Manages Schedule (Daily) vs Recent (Incremental) sync to prevent database locks
 */

import { logger } from '../../../utils/logger';

export enum SyncType {
  SCHEDULE = 'SCHEDULE', // Daily bulk sync
  RECENT = 'RECENT',     // Incremental sync
}

class SyncLock {
  private locks: Map<SyncType, boolean> = new Map();
  private queue: Array<{ type: SyncType; resolve: () => void }> = [];

  /**
   * Acquire lock for sync type
   */
  async acquire(type: SyncType): Promise<void> {
    // If lock is already held, wait in queue
    if (this.locks.get(type)) {
      return new Promise((resolve) => {
        this.queue.push({ type, resolve });
      });
    }

    // Acquire lock
    this.locks.set(type, true);
    logger.info(`Sync lock acquired: ${type}`);
  }

  /**
   * Release lock and process queue
   */
  release(type: SyncType): void {
    this.locks.set(type, false);
    logger.info(`Sync lock released: ${type}`);

    // Process queue
    const next = this.queue.find(item => item.type === type);
    if (next) {
      this.queue = this.queue.filter(item => item !== next);
      this.locks.set(type, true);
      next.resolve();
    }
  }

  /**
   * Check if lock is held
   */
  isLocked(type: SyncType): boolean {
    return this.locks.get(type) || false;
  }
}

export const syncLock = new SyncLock();

/**
 * Prevent Schedule and Recent sync from running simultaneously
 */
export async function withSyncLock<T>(
  type: SyncType,
  operation: () => Promise<T>
): Promise<T> {
  await syncLock.acquire(type);

  try {
    const result = await operation();
    return result;
  } finally {
    syncLock.release(type);
  }
}

/**
 * Check if sync can proceed
 */
export function canSync(type: SyncType): boolean {
  // Schedule sync blocks Recent sync
  if (type === SyncType.RECENT && syncLock.isLocked(SyncType.SCHEDULE)) {
    logger.warn('Recent sync blocked: Schedule sync in progress');
    return false;
  }

  // Recent sync blocks Schedule sync
  if (type === SyncType.SCHEDULE && syncLock.isLocked(SyncType.RECENT)) {
    logger.warn('Schedule sync blocked: Recent sync in progress');
    return false;
  }

  return true;
}


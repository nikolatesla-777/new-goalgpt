"use strict";
/**
 * Sync Strategy
 *
 * Manages Schedule (Daily) vs Recent (Incremental) sync to prevent database locks
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncLock = exports.SyncType = void 0;
exports.withSyncLock = withSyncLock;
exports.canSync = canSync;
const logger_1 = require("../../../utils/logger");
var SyncType;
(function (SyncType) {
    SyncType["SCHEDULE"] = "SCHEDULE";
    SyncType["RECENT"] = "RECENT";
})(SyncType || (exports.SyncType = SyncType = {}));
class SyncLock {
    constructor() {
        this.locks = new Map();
        this.queue = [];
    }
    /**
     * Acquire lock for sync type
     */
    async acquire(type) {
        // If lock is already held, wait in queue
        if (this.locks.get(type)) {
            return new Promise((resolve) => {
                this.queue.push({ type, resolve });
            });
        }
        // Acquire lock
        this.locks.set(type, true);
        logger_1.logger.info(`Sync lock acquired: ${type}`);
    }
    /**
     * Release lock and process queue
     */
    release(type) {
        this.locks.set(type, false);
        logger_1.logger.info(`Sync lock released: ${type}`);
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
    isLocked(type) {
        return this.locks.get(type) || false;
    }
}
exports.syncLock = new SyncLock();
/**
 * Prevent Schedule and Recent sync from running simultaneously
 */
async function withSyncLock(type, operation) {
    await exports.syncLock.acquire(type);
    try {
        const result = await operation();
        return result;
    }
    finally {
        exports.syncLock.release(type);
    }
}
/**
 * Check if sync can proceed
 */
function canSync(type) {
    // Schedule sync blocks Recent sync
    if (type === SyncType.RECENT && exports.syncLock.isLocked(SyncType.SCHEDULE)) {
        logger_1.logger.warn('Recent sync blocked: Schedule sync in progress');
        return false;
    }
    // Recent sync blocks Schedule sync
    if (type === SyncType.SCHEDULE && exports.syncLock.isLocked(SyncType.RECENT)) {
        logger_1.logger.warn('Schedule sync blocked: Recent sync in progress');
        return false;
    }
    return true;
}

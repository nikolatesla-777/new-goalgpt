"use strict";
/**
 * Unified Entity Sync Job
 *
 * Consolidates all entity sync operations (categories, countries, competitions,
 * teams, players, coaches, referees, seasons, stages, venues) into a single
 * managed job with proper scheduling and dependency ordering.
 *
 * REPLACES:
 * - categorySync.job.ts
 * - countrySync.job.ts
 * - competitionSync.job.ts
 * - teamSync.job.ts
 * - playerSync.job.ts
 * - coachSync.job.ts
 * - refereeSync.job.ts
 * - seasonSync.job.ts
 * - stageSync.job.ts
 * - venueSync.job.ts
 *
 * NOTE: teamDataSync.job.ts and teamLogoSync.job.ts are kept separate
 * in server.ts as they use a different service pattern
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runFullEntitySync = runFullEntitySync;
exports.startEntitySyncJobs = startEntitySyncJobs;
exports.stopEntitySyncJobs = stopEntitySyncJobs;
exports.getEntitySyncStatus = getEntitySyncStatus;
exports.triggerEntitySync = triggerEntitySync;
const cron = __importStar(require("node-cron"));
const logger_1 = require("../utils/logger");
const obsLogger_1 = require("../utils/obsLogger");
const ENTITY_CONFIGS = [
    // Level 1: Base entities (no FK dependencies)
    {
        name: 'Category',
        servicePath: '../services/thesports/category/categorySync.service',
        serviceClass: 'CategorySyncService',
        syncMethod: 'syncAllCategories',
        dailySchedule: '0 1 * * *', // 01:00
        incrementalSchedule: '0 13 * * *', // 13:00
        runOnStartup: true,
    },
    {
        name: 'Country',
        servicePath: '../services/thesports/country/countrySync.service',
        serviceClass: 'CountrySyncService',
        syncMethod: 'syncAllCountries',
        dailySchedule: '30 1 * * *', // 01:30
        incrementalSchedule: '30 13 * * *', // 13:30
        runOnStartup: true,
        delayAfterPrevious: 5000,
    },
    // Level 2: Competition-related (depends on Category, Country)
    {
        name: 'Season',
        servicePath: '../services/thesports/season/seasonSync.service',
        serviceClass: 'SeasonSyncService',
        syncMethod: 'syncAllSeasons',
        dailySchedule: '45 1 * * *', // 01:45
        runOnStartup: false,
    },
    {
        name: 'Stage',
        servicePath: '../services/thesports/stage/stageSync.service',
        serviceClass: 'StageSyncService',
        syncMethod: 'syncAllStages',
        dailySchedule: '50 1 * * *', // 01:50
        runOnStartup: false,
    },
    {
        name: 'Competition',
        servicePath: '../services/thesports/competition/leagueSync.service',
        serviceClass: 'LeagueSyncService',
        syncMethod: 'sync',
        dailySchedule: '0 2 * * *', // 02:00
        incrementalSchedule: '0 8,14,20 * * *', // 08:00, 14:00, 20:00
        runOnStartup: true,
        delayAfterPrevious: 10000,
    },
    {
        name: 'Venue',
        servicePath: '../services/thesports/venue/venueSync.service',
        serviceClass: 'VenueSyncService',
        syncMethod: 'syncAllVenues',
        dailySchedule: '30 2 * * *', // 02:30
        runOnStartup: false,
    },
    // Level 3: Team-related (depends on Competition)
    {
        name: 'Team',
        servicePath: '../services/thesports/team/teamSync.service',
        serviceClass: 'TeamSyncService',
        syncMethod: 'sync',
        dailySchedule: '0 3 * * *', // 03:00
        incrementalSchedule: '0 9,15,21 * * *', // 09:00, 15:00, 21:00
        runOnStartup: true,
        delayAfterPrevious: 10000,
    },
    // Note: TeamData and TeamLogo workers kept in server.ts for now
    // They use a different pattern (TeamDataService, TeamLogoService with Repository)
    {
        name: 'Coach',
        servicePath: '../services/thesports/coach/coachSync.service',
        serviceClass: 'CoachSyncService',
        syncMethod: 'syncAllCoaches',
        dailySchedule: '30 4 * * *', // 04:30
        runOnStartup: false,
    },
    {
        name: 'Referee',
        servicePath: '../services/thesports/referee/refereeSync.service',
        serviceClass: 'RefereeSyncService',
        syncMethod: 'syncAllReferees',
        dailySchedule: '45 4 * * *', // 04:45
        runOnStartup: false,
    },
    // Level 4: Player-related (depends on Team) - HIGH VOLUME
    {
        name: 'Player',
        servicePath: '../services/thesports/player/playerSync.service',
        serviceClass: 'PlayerSyncService',
        syncMethod: 'sync',
        dailySchedule: '0 5 * * *', // 05:00 daily incremental
        weeklyOnly: false, // Full sync only on Sunday
        runOnStartup: false, // Too high volume
    },
];
// Running state for each entity
const runningState = new Map();
/**
 * Dynamic service loader with caching
 */
const serviceCache = new Map();
async function getService(config) {
    const cacheKey = config.servicePath;
    if (serviceCache.has(cacheKey)) {
        return serviceCache.get(cacheKey);
    }
    try {
        const module = await Promise.resolve(`${config.servicePath}`).then(s => __importStar(require(s)));
        const ServiceClass = module[config.serviceClass];
        const instance = new ServiceClass();
        serviceCache.set(cacheKey, instance);
        return instance;
    }
    catch (error) {
        logger_1.logger.error(`[EntitySync] Failed to load service for ${config.name}:`, error.message);
        return null;
    }
}
/**
 * Run sync for a specific entity
 */
async function runEntitySync(config, isIncremental = false) {
    const entityName = config.name;
    // Check if already running
    if (runningState.get(entityName)) {
        logger_1.logger.warn(`[EntitySync] ${entityName} sync is already running, skipping.`);
        return;
    }
    runningState.set(entityName, true);
    const startTime = Date.now();
    try {
        logger_1.logger.info(`[EntitySync] Starting ${entityName} sync (${isIncremental ? 'incremental' : 'full'})...`);
        const service = await getService(config);
        if (!service) {
            logger_1.logger.error(`[EntitySync] Service not available for ${entityName}`);
            return;
        }
        // Call the sync method
        const method = isIncremental && service.syncIncremental
            ? 'syncIncremental'
            : config.syncMethod;
        if (typeof service[method] !== 'function') {
            logger_1.logger.error(`[EntitySync] Method ${method} not found on ${entityName} service`);
            return;
        }
        const result = await service[method]();
        const duration = Date.now() - startTime;
        // Log result based on what's returned
        if (result && typeof result === 'object') {
            const { synced = 0, total = 0, errors = 0, isFullUpdate } = result;
            logger_1.logger.info(`[EntitySync] ${entityName} sync completed: ${synced}/${total} synced, ${errors} errors ` +
                `(${isFullUpdate !== undefined ? (isFullUpdate ? 'FULL' : 'INCREMENTAL') : isIncremental ? 'INCREMENTAL' : 'FULL'}) ` +
                `[${duration}ms]`);
        }
        else {
            logger_1.logger.info(`[EntitySync] ${entityName} sync completed [${duration}ms]`);
        }
    }
    catch (error) {
        const duration = Date.now() - startTime;
        logger_1.logger.error(`[EntitySync] ${entityName} sync failed [${duration}ms]:`, error.message);
    }
    finally {
        runningState.set(entityName, false);
    }
}
/**
 * Run all entity syncs in sequence (for startup or manual trigger)
 */
async function runFullEntitySync() {
    logger_1.logger.info('[EntitySync] Starting full entity sync sequence...');
    for (const config of ENTITY_CONFIGS) {
        if (!config.runOnStartup)
            continue;
        await runEntitySync(config, false);
        // Delay between entities to avoid rate limits
        if (config.delayAfterPrevious) {
            await new Promise(resolve => setTimeout(resolve, config.delayAfterPrevious));
        }
    }
    logger_1.logger.info('[EntitySync] Full entity sync sequence completed');
}
/**
 * Schedule all entity sync cron jobs
 */
const scheduledJobs = [];
function startEntitySyncJobs() {
    logger_1.logger.info('[EntitySync] Scheduling entity sync jobs...');
    for (const config of ENTITY_CONFIGS) {
        // Daily/main sync
        const dailyJob = cron.schedule(config.dailySchedule, async () => {
            // For Player, check if it's Sunday for full sync
            if (config.name === 'Player') {
                const now = new Date();
                const isSunday = now.getDay() === 0;
                await runEntitySync(config, !isSunday); // Full on Sunday, incremental otherwise
            }
            else {
                await runEntitySync(config, false);
            }
        });
        scheduledJobs.push(dailyJob);
        logger_1.logger.info(`  - ${config.name}: ${config.dailySchedule}`);
        // Incremental sync (if configured)
        if (config.incrementalSchedule) {
            const incrementalJob = cron.schedule(config.incrementalSchedule, async () => {
                await runEntitySync(config, true);
            });
            scheduledJobs.push(incrementalJob);
            logger_1.logger.info(`  - ${config.name} (incremental): ${config.incrementalSchedule}`);
        }
    }
    (0, obsLogger_1.logEvent)('info', 'entitySync.started', {
        entities: ENTITY_CONFIGS.map(c => c.name),
        totalJobs: scheduledJobs.length,
    });
    logger_1.logger.info(`[EntitySync] ${scheduledJobs.length} sync jobs scheduled`);
}
/**
 * Stop all scheduled jobs
 */
function stopEntitySyncJobs() {
    scheduledJobs.forEach(job => job.stop());
    scheduledJobs.length = 0;
    serviceCache.clear();
    runningState.clear();
    logger_1.logger.info('[EntitySync] All entity sync jobs stopped');
}
/**
 * Get sync status for all entities
 */
function getEntitySyncStatus() {
    const status = {};
    for (const config of ENTITY_CONFIGS) {
        status[config.name] = {
            isRunning: runningState.get(config.name) || false,
            schedule: config.dailySchedule,
        };
    }
    return status;
}
/**
 * Manually trigger sync for a specific entity
 */
async function triggerEntitySync(entityName, incremental = false) {
    const config = ENTITY_CONFIGS.find(c => c.name.toLowerCase() === entityName.toLowerCase());
    if (!config) {
        logger_1.logger.error(`[EntitySync] Unknown entity: ${entityName}`);
        return false;
    }
    await runEntitySync(config, incremental);
    return true;
}

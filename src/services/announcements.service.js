"use strict";
/**
 * Announcements Service - Admin Popup Management
 *
 * Features:
 * - Create/Update/Delete announcements from admin panel
 * - Fetch active announcements for mobile app
 * - Target specific user groups (all, vip, free)
 * - Schedule announcements with start/end dates
 * - Track dismissals per user
 */
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAnnouncement = createAnnouncement;
exports.updateAnnouncement = updateAnnouncement;
exports.deleteAnnouncement = deleteAnnouncement;
exports.getAllAnnouncements = getAllAnnouncements;
exports.getAnnouncementById = getAnnouncementById;
exports.getActiveAnnouncementsForUser = getActiveAnnouncementsForUser;
exports.dismissAnnouncement = dismissAnnouncement;
exports.updateAnnouncementStatuses = updateAnnouncementStatuses;
exports.getAnnouncementStats = getAnnouncementStats;
var kysely_1 = require("../database/kysely");
var kysely_2 = require("kysely");
// ============================================================================
// ADMIN FUNCTIONS
// ============================================================================
/**
 * Create a new announcement
 */
function createAnnouncement(input, adminUserId) {
    return __awaiter(this, void 0, void 0, function () {
        var now, status, startDate, announcement;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    now = new Date();
                    status = 'draft';
                    if (input.start_date) {
                        startDate = new Date(input.start_date);
                        if (startDate <= now) {
                            status = 'active';
                        }
                        else {
                            status = 'scheduled';
                        }
                    }
                    return [4 /*yield*/, kysely_1.db
                            .insertInto('announcements')
                            .values({
                            title: input.title,
                            message: input.message,
                            image_url: input.image_url || null,
                            button_text: input.button_text || null,
                            button_url: input.button_url || null,
                            button_action: input.button_action || null,
                            target_audience: input.target_audience || 'all',
                            announcement_type: input.announcement_type || 'popup',
                            status: status,
                            priority: input.priority || 0,
                            show_once: (_a = input.show_once) !== null && _a !== void 0 ? _a : true,
                            start_date: input.start_date ? new Date(input.start_date) : null,
                            end_date: input.end_date ? new Date(input.end_date) : null,
                            created_by: adminUserId || null,
                            created_at: now,
                            updated_at: now,
                        })
                            .returningAll()
                            .executeTakeFirstOrThrow()];
                case 1:
                    announcement = _b.sent();
                    return [2 /*return*/, announcement];
            }
        });
    });
}
/**
 * Update an announcement
 */
function updateAnnouncement(id, input) {
    return __awaiter(this, void 0, void 0, function () {
        var updateData, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    updateData = {
                        updated_at: new Date(),
                    };
                    if (input.title !== undefined)
                        updateData.title = input.title;
                    if (input.message !== undefined)
                        updateData.message = input.message;
                    if (input.image_url !== undefined)
                        updateData.image_url = input.image_url;
                    if (input.button_text !== undefined)
                        updateData.button_text = input.button_text;
                    if (input.button_url !== undefined)
                        updateData.button_url = input.button_url;
                    if (input.button_action !== undefined)
                        updateData.button_action = input.button_action;
                    if (input.target_audience !== undefined)
                        updateData.target_audience = input.target_audience;
                    if (input.announcement_type !== undefined)
                        updateData.announcement_type = input.announcement_type;
                    if (input.status !== undefined)
                        updateData.status = input.status;
                    if (input.priority !== undefined)
                        updateData.priority = input.priority;
                    if (input.show_once !== undefined)
                        updateData.show_once = input.show_once;
                    if (input.start_date !== undefined)
                        updateData.start_date = input.start_date ? new Date(input.start_date) : null;
                    if (input.end_date !== undefined)
                        updateData.end_date = input.end_date ? new Date(input.end_date) : null;
                    return [4 /*yield*/, kysely_1.db
                            .updateTable('announcements')
                            .set(updateData)
                            .where('id', '=', id)
                            .returningAll()
                            .executeTakeFirst()];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result];
            }
        });
    });
}
/**
 * Delete an announcement
 */
function deleteAnnouncement(id) {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .deleteFrom('announcements')
                        .where('id', '=', id)
                        .executeTakeFirst()];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, Number(result.numDeletedRows) > 0];
            }
        });
    });
}
/**
 * Get all announcements (admin)
 */
function getAllAnnouncements() {
    return __awaiter(this, arguments, void 0, function (limit, offset) {
        var announcements;
        if (limit === void 0) { limit = 50; }
        if (offset === void 0) { offset = 0; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .selectFrom('announcements')
                        .selectAll()
                        .orderBy('created_at', 'desc')
                        .limit(limit)
                        .offset(offset)
                        .execute()];
                case 1:
                    announcements = _a.sent();
                    return [2 /*return*/, announcements];
            }
        });
    });
}
/**
 * Get announcement by ID
 */
function getAnnouncementById(id) {
    return __awaiter(this, void 0, void 0, function () {
        var announcement;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .selectFrom('announcements')
                        .selectAll()
                        .where('id', '=', id)
                        .executeTakeFirst()];
                case 1:
                    announcement = _a.sent();
                    return [2 /*return*/, announcement];
            }
        });
    });
}
// ============================================================================
// MOBILE APP FUNCTIONS
// ============================================================================
/**
 * Get active announcements for a user
 */
function getActiveAnnouncementsForUser(userId_1) {
    return __awaiter(this, arguments, void 0, function (userId, isVip) {
        var now, targets, announcements;
        if (isVip === void 0) { isVip = false; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    now = new Date();
                    targets = ['all'];
                    if (isVip) {
                        targets.push('vip');
                    }
                    else {
                        targets.push('free');
                    }
                    return [4 /*yield*/, kysely_1.db
                            .selectFrom('announcements as a')
                            .leftJoin('announcement_dismissals as ad', function (join) {
                            return join
                                .onRef('ad.announcement_id', '=', 'a.id')
                                .on('ad.user_id', '=', userId);
                        })
                            .selectAll('a')
                            .where('a.status', '=', 'active')
                            .where('a.target_audience', 'in', targets)
                            .where(function (eb) {
                            return eb.or([
                                eb('a.start_date', 'is', null),
                                eb('a.start_date', '<=', now),
                            ]);
                        })
                            .where(function (eb) {
                            return eb.or([
                                eb('a.end_date', 'is', null),
                                eb('a.end_date', '>=', now),
                            ]);
                        })
                            .where(function (eb) {
                            return eb.or([
                                eb('a.show_once', '=', false),
                                eb('ad.id', 'is', null), // Not dismissed yet
                            ]);
                        })
                            .orderBy('a.priority', 'desc')
                            .orderBy('a.created_at', 'desc')
                            .execute()];
                case 1:
                    announcements = _a.sent();
                    return [2 /*return*/, announcements];
            }
        });
    });
}
/**
 * Dismiss an announcement for a user
 */
function dismissAnnouncement(userId, announcementId) {
    return __awaiter(this, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, kysely_1.db
                            .insertInto('announcement_dismissals')
                            .values({
                            user_id: userId,
                            announcement_id: announcementId,
                            dismissed_at: (0, kysely_2.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                        })
                            .onConflict(function (oc) {
                            return oc.columns(['user_id', 'announcement_id']).doNothing();
                        })
                            .execute()];
                case 1:
                    _a.sent();
                    return [2 /*return*/, true];
                case 2:
                    error_1 = _a.sent();
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Update announcement statuses (cron job)
 * - Activate scheduled announcements
 * - Expire ended announcements
 */
function updateAnnouncementStatuses() {
    return __awaiter(this, void 0, void 0, function () {
        var now, activatedResult, expiredResult;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    now = new Date();
                    return [4 /*yield*/, kysely_1.db
                            .updateTable('announcements')
                            .set({ status: 'active', updated_at: now })
                            .where('status', '=', 'scheduled')
                            .where('start_date', '<=', now)
                            .executeTakeFirst()];
                case 1:
                    activatedResult = _a.sent();
                    return [4 /*yield*/, kysely_1.db
                            .updateTable('announcements')
                            .set({ status: 'expired', updated_at: now })
                            .where('status', '=', 'active')
                            .where('end_date', '<', now)
                            .executeTakeFirst()];
                case 2:
                    expiredResult = _a.sent();
                    return [2 /*return*/, {
                            activated: Number(activatedResult.numUpdatedRows || 0),
                            expired: Number(expiredResult.numUpdatedRows || 0),
                        }];
            }
        });
    });
}
/**
 * Get announcement statistics
 */
function getAnnouncementStats() {
    return __awaiter(this, void 0, void 0, function () {
        var stats, dismissalStats;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .selectFrom('announcements')
                        .select([
                        (0, kysely_2.sql)(templateObject_2 || (templateObject_2 = __makeTemplateObject(["COUNT(*)"], ["COUNT(*)"]))).as('total'),
                        (0, kysely_2.sql)(templateObject_3 || (templateObject_3 = __makeTemplateObject(["COUNT(*) FILTER (WHERE status = 'active')"], ["COUNT(*) FILTER (WHERE status = 'active')"]))).as('active'),
                        (0, kysely_2.sql)(templateObject_4 || (templateObject_4 = __makeTemplateObject(["COUNT(*) FILTER (WHERE status = 'scheduled')"], ["COUNT(*) FILTER (WHERE status = 'scheduled')"]))).as('scheduled'),
                        (0, kysely_2.sql)(templateObject_5 || (templateObject_5 = __makeTemplateObject(["COUNT(*) FILTER (WHERE status = 'draft')"], ["COUNT(*) FILTER (WHERE status = 'draft')"]))).as('draft'),
                        (0, kysely_2.sql)(templateObject_6 || (templateObject_6 = __makeTemplateObject(["COUNT(*) FILTER (WHERE status = 'expired')"], ["COUNT(*) FILTER (WHERE status = 'expired')"]))).as('expired'),
                    ])
                        .executeTakeFirst()];
                case 1:
                    stats = _a.sent();
                    return [4 /*yield*/, kysely_1.db
                            .selectFrom('announcement_dismissals')
                            .select([
                            (0, kysely_2.sql)(templateObject_7 || (templateObject_7 = __makeTemplateObject(["COUNT(DISTINCT user_id)"], ["COUNT(DISTINCT user_id)"]))).as('unique_users'),
                            (0, kysely_2.sql)(templateObject_8 || (templateObject_8 = __makeTemplateObject(["COUNT(*)"], ["COUNT(*)"]))).as('total_dismissals'),
                        ])
                            .executeTakeFirst()];
                case 2:
                    dismissalStats = _a.sent();
                    return [2 /*return*/, {
                            total: Number((stats === null || stats === void 0 ? void 0 : stats.total) || 0),
                            active: Number((stats === null || stats === void 0 ? void 0 : stats.active) || 0),
                            scheduled: Number((stats === null || stats === void 0 ? void 0 : stats.scheduled) || 0),
                            draft: Number((stats === null || stats === void 0 ? void 0 : stats.draft) || 0),
                            expired: Number((stats === null || stats === void 0 ? void 0 : stats.expired) || 0),
                            uniqueUsersDismissed: Number((dismissalStats === null || dismissalStats === void 0 ? void 0 : dismissalStats.unique_users) || 0),
                            totalDismissals: Number((dismissalStats === null || dismissalStats === void 0 ? void 0 : dismissalStats.total_dismissals) || 0),
                        }];
            }
        });
    });
}
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8;

"use strict";
/**
 * Cache Types and Constants
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheTTL = exports.CacheKeyPrefix = void 0;
var CacheKeyPrefix;
(function (CacheKeyPrefix) {
    CacheKeyPrefix["TheSports"] = "thesports";
    CacheKeyPrefix["Match"] = "match";
    CacheKeyPrefix["Team"] = "team";
})(CacheKeyPrefix || (exports.CacheKeyPrefix = CacheKeyPrefix = {}));
var CacheTTL;
(function (CacheTTL) {
    CacheTTL[CacheTTL["TenSeconds"] = 10] = "TenSeconds";
    CacheTTL[CacheTTL["ThirtySeconds"] = 30] = "ThirtySeconds";
    CacheTTL[CacheTTL["Minute"] = 60] = "Minute";
    CacheTTL[CacheTTL["FiveMinutes"] = 300] = "FiveMinutes";
    CacheTTL[CacheTTL["TenMinutes"] = 600] = "TenMinutes";
    CacheTTL[CacheTTL["ThirtyMinutes"] = 1800] = "ThirtyMinutes";
    CacheTTL[CacheTTL["Hour"] = 3600] = "Hour";
    CacheTTL[CacheTTL["Day"] = 86400] = "Day";
})(CacheTTL || (exports.CacheTTL = CacheTTL = {}));

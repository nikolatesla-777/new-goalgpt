"use strict";
/**
 * FootyStats Integration Module
 *
 * Exports all FootyStats services and types for easy import
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.stringSimilarity = exports.normalizeString = exports.FootyStatsMappingService = exports.mappingService = exports.FootyStatsAPIClient = exports.footyStatsAPI = void 0;
// API Client
var footystats_client_1 = require("./footystats.client");
Object.defineProperty(exports, "footyStatsAPI", { enumerable: true, get: function () { return footystats_client_1.footyStatsAPI; } });
Object.defineProperty(exports, "FootyStatsAPIClient", { enumerable: true, get: function () { return footystats_client_1.FootyStatsAPIClient; } });
// Mapping Service
var mapping_service_1 = require("./mapping.service");
Object.defineProperty(exports, "mappingService", { enumerable: true, get: function () { return mapping_service_1.mappingService; } });
Object.defineProperty(exports, "FootyStatsMappingService", { enumerable: true, get: function () { return mapping_service_1.FootyStatsMappingService; } });
Object.defineProperty(exports, "normalizeString", { enumerable: true, get: function () { return mapping_service_1.normalizeString; } });
Object.defineProperty(exports, "stringSimilarity", { enumerable: true, get: function () { return mapping_service_1.stringSimilarity; } });

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const kysely_1 = require("kysely");
const connection_1 = require("./connection");
// Create and export Kysely instance
exports.db = new kysely_1.Kysely({
    dialect: new kysely_1.PostgresDialect({ pool: connection_1.pool }),
});
// Export for convenience
exports.default = exports.db;

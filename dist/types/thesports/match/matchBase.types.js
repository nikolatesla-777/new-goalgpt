"use strict";
/**
 * Match Base Types
 *
 * Shared type definitions for match-related data structures
 * Created: 2026-01-09 (Phase 2: Type Safety)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCORE_INDEX = void 0;
/**
 * Score array index constants for type-safe access
 *
 * Use these instead of magic numbers to access score array elements.
 * Provides compile-time safety and better code readability.
 *
 * @example
 * const scores: ScoreArray = [2, 1, 0, 3, 7, 0, 0];
 * const redCards = scores[SCORE_INDEX.RED_CARDS]; // 0
 * const corners = scores[SCORE_INDEX.CORNERS];     // 7
 */
exports.SCORE_INDEX = {
    /** Index 0: Regular time score */
    REGULAR: 0,
    /** Index 1: Halftime score */
    HALFTIME: 1,
    /** Index 2: Red cards count */
    RED_CARDS: 2,
    /** Index 3: Yellow cards count */
    YELLOW_CARDS: 3,
    /** Index 4: Corner kicks count */
    CORNERS: 4,
    /** Index 5: Overtime score */
    OVERTIME: 5,
    /** Index 6: Penalty shootout score */
    PENALTY: 6,
};

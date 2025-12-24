/**
 * WebSocket Message Types
 * 
 * Type definitions for TheSports WebSocket messages
 */

import { MatchState, TechnicalStatistics } from '../enums';

export interface WebSocketScoreMessage {
  id: string;
  score: [
    string,      // Match id
    number,      // Match status (MatchState enum)
    number[],    // Home team [score, halftime, red, yellow, corners, overtime, penalty]
    number[],    // Away team [score, halftime, red, yellow, corners, overtime, penalty]
    number       // Message timestamp (NOT kickoff) - unix seconds
  ];
}

export interface WebSocketStatsMessage {
  id: string;
  stats: Array<{
    type: number;  // TechnicalStatistics enum
    home: number;
    away: number;
  }>;
}

export interface WebSocketIncidentMessage {
  id: string;
  incidents: Array<{
    type: number;              // TechnicalStatistics enum
    position: 0 | 1 | 2;       // 0-neutral, 1-home, 2-away
    time: number;              // Time (minutes)
    player_id?: string;
    player_name?: string;
    assist1_id?: string;
    assist1_name?: string;
    assist2_id?: string;
    assist2_name?: string;
    in_player_id?: string;     // Substitution
    in_player_name?: string;   // Substitution
    out_player_id?: string;    // Substitution
    out_player_name?: string;  // Substitution
    home_score?: number;       // Goal incident
    away_score?: number;       // Goal incident
    var_reason?: number;        // VAR reason
    var_result?: number;        // VAR result
    reason_type?: number;       // Event reason
  }>;
}

export interface WebSocketTliveMessage {
  id: string;
  tlive: Array<{
    time: string;              // "51'"
    data: string;              // "51'Goal! VfB Stuttgart 0-1 Atalanta..."
    position: 0 | 1 | 2;       // 0-neutral, 1-home, 2-away
  }>;
}

export interface WebSocketMessage {
  score?: WebSocketScoreMessage[];
  stats?: WebSocketStatsMessage[];
  incidents?: WebSocketIncidentMessage[];
  tlive?: WebSocketTliveMessage[];
}

export interface ParsedScore {
  matchId: string;
  status: MatchState;
  statusId: number; // Raw status_id from API (Index 1)
  messageTimestamp: number; // Score message timestamp (Index 4) - unix seconds
  liveKickoffTime: number | null; // Real 1st-half kickoff timestamp if known (DO NOT derive from score Index 4)
  home: {
    score: number; // Display score (calculated)
    regularScore: number; // Index 0: Regular time score (90 min)
    overtimeScore: number; // Index 5: Overtime score (120 min aggregate)
    penaltyScore: number; // Index 6: Penalty shootout score
    halftime: number;
    redCards: number;
    yellowCards: number;
    corners: number;
    overtime: number; // Legacy field (same as overtimeScore)
    penalty: number; // Legacy field (same as penaltyScore)
  };
  away: {
    score: number; // Display score (calculated)
    regularScore: number; // Index 0: Regular time score (90 min)
    overtimeScore: number; // Index 5: Overtime score (120 min aggregate)
    penaltyScore: number; // Index 6: Penalty shootout score
    halftime: number;
    redCards: number;
    yellowCards: number;
    corners: number;
    overtime: number; // Legacy field (same as overtimeScore)
    penalty: number; // Legacy field (same as penaltyScore)
  };
  kickoffTimestamp: number | null; // Legacy field (same as liveKickoffTime)
}

export interface ParsedIncident {
  matchId: string;
  type: TechnicalStatistics;
  position: 0 | 1 | 2;
  time: number;
  playerId?: string;
  playerName?: string;
  assist1Id?: string;
  assist1Name?: string;
  assist2Id?: string;
  assist2Name?: string;
  inPlayerId?: string; // Substitution in
  inPlayerName?: string;
  outPlayerId?: string; // Substitution out
  outPlayerName?: string;
  homeScore?: number;
  awayScore?: number;
  varReason?: number; // VARReason enum
  varResult?: number; // VARResult enum (2 = GOAL_CANCELLED)
  reasonType?: number; // EventReason enum
  isGoal: boolean;
  isCard: boolean;
  isSubstitution: boolean;
  isVAR: boolean;
  isGoalCancelled?: boolean; // true if var_result === 2 (GOAL_CANCELLED)
}

/**
 * Prediction Event Types
 *
 * Type definitions for PredictionOrchestrator events
 */

export interface PredictionEvent {
  predictionId: string;
  timestamp: number;
}

export interface PredictionCreatedEvent extends PredictionEvent {
  externalId: string;
  botName: string;
  matchId: string | null;
  prediction: string;
  accessType: 'VIP' | 'FREE';
}

export interface PredictionUpdatedEvent extends PredictionEvent {
  fields: string[];
}

export interface PredictionDeletedEvent extends PredictionEvent {}

export interface PredictionCreateData {
  external_id: string;
  canonical_bot_name: string;
  league_name: string;
  home_team_name: string;
  away_team_name: string;
  home_team_logo?: string;
  away_team_logo?: string;
  score_at_prediction: string;
  minute_at_prediction: number;
  prediction: string;
  prediction_threshold: number;
  match_id?: string | null;
  match_time?: number | null;
  match_status?: number;
  access_type?: 'VIP' | 'FREE';
  source?: 'external' | 'manual';
}

export interface PredictionUpdateData {
  access_type?: 'VIP' | 'FREE';
  match_id?: string | null;
  match_time?: number | null;
  match_status?: number;
}

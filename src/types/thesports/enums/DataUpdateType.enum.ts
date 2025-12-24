/**
 * Data Update Type Enum
 * 
 * Represents types of data updates from TheSports API
 */

export enum DataUpdateType {
  SINGLE_MATCH_LINEUP = 1,        // single match lineup
  BRACKET = 2,                    // bracket
  SEASON_STANDING = 3,            // season standing
  SEASON_TEAM_STATISTICS = 4,     // season team statistics
  SEASON_PLAYER_STATISTICS = 5,   // season player statistics
  SEASON_TOP_SCORER = 6,          // season top scorer
  FIFA_MEN = 7,                   // fifa men
  FIFA_WOMEN = 8,                 // fifa women
  WORLD_CLUBS_RANKING = 9,        // world clubs ranking
  MATCH_INCIDENT_GIF = 10,        // match incident gif
  MATCH_GOAL_LINE = 11            // match goal line
}


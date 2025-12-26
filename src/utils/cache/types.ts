/**
 * Cache Types and Constants
 */

export enum CacheKeyPrefix {
  TheSports = 'thesports',
  Match = 'match',
  Team = 'team',
}

export enum CacheTTL {
  TenSeconds = 10,
  ThirtySeconds = 30,
  Minute = 60,
  FiveMinutes = 5 * 60,
  TenMinutes = 10 * 60,
  ThirtyMinutes = 30 * 60,
  Hour = 60 * 60,
  Day = 24 * 60 * 60,
}

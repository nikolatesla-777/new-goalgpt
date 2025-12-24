/**
 * Event Reason Enum
 * 
 * Represents reasons for events (cards, substitutions, etc.) (0-37)
 */

export enum EventReason {
  UNKNOWN = 0,                    // Unknown
  FOUL = 1,                       // Foul
  PROFESSIONAL_FOUL = 2,          // Professional foul
  ENCROACHMENT_OR_INJURY = 3,     // Encroachment (Card) / Injury substitution (Substitution)
  TACTICAL = 4,                   // Tactical Foul (Card) / Tactical substitution (Substitution)
  RECKLESS_OFFENCE = 5,           // Reckless Offence
  OFF_THE_BALL_FOUL = 6,          // Off the ball foul
  PERSISTENT_FOULING = 7,         // Persistent fouling
  PERSISTENT_INFRINGEMENT = 8,    // Persistent Infringement
  VIOLENT_CONDUCT = 9,            // Violent conduct
  DANGEROUS_PLAY = 10,            // Dangerous play
  HANDBALL = 11,                  // Handball
  SERIOUS_FOUL = 12,              // Serious Foul
  PROFESSIONAL_FOUL_LAST_MAN = 13, // Professional foul last man
  DENIED_GOAL_SCORING = 14,       // Denied goal-scoring opportunity
  TIME_WASTING = 15,              // Time wasting
  VIDEO_SYNC_DONE = 16,          // Video sync done
  RESCINDED_CARD = 17,            // Rescinded Card
  ARGUMENT = 18,                  // Argument
  DISSENT = 19,                   // Dissent
  FOUL_ABUSIVE_LANGUAGE = 20,     // Foul and Abusive Language
  EXCESSIVE_CELEBRATION = 21,     // Excessive celebration
  NOT_RETREATING = 22,            // Not Retreating
  FIGHT = 23,                     // Fight
  EXTRA_FLAG_TO_CHECKER = 24,     // Extra flag to checker
  ON_BENCH = 25,                  // On bench
  POST_MATCH = 26,                // Post match
  OTHER_REASON = 27,              // Other reason
  UNALLOWED_FIELD_ENTERING = 28,  // Unallowed field entering
  ENTERING_FIELD = 29,            // Entering field
  LEAVING_FIELD = 30,             // Leaving field
  UNSPORTING_BEHAVIOUR = 31,      // Unsporting behaviour
  NOT_VISIBLE = 32,               // Not visible
  FLOP = 33,                      // Flop
  EXCESSIVE_REVIEW_SIGNAL = 34,   // Excessive usage of review signal
  ENTERING_REFEREE_REVIEW = 35,   // Entering referee review area
  SPITTING = 36,                  // Spitting
  VIRAL = 37                      // Viral
}


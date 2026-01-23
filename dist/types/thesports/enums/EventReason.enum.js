"use strict";
/**
 * Event Reason Enum
 *
 * Represents reasons for events (cards, substitutions, etc.) (0-37)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventReason = void 0;
var EventReason;
(function (EventReason) {
    EventReason[EventReason["UNKNOWN"] = 0] = "UNKNOWN";
    EventReason[EventReason["FOUL"] = 1] = "FOUL";
    EventReason[EventReason["PROFESSIONAL_FOUL"] = 2] = "PROFESSIONAL_FOUL";
    EventReason[EventReason["ENCROACHMENT_OR_INJURY"] = 3] = "ENCROACHMENT_OR_INJURY";
    EventReason[EventReason["TACTICAL"] = 4] = "TACTICAL";
    EventReason[EventReason["RECKLESS_OFFENCE"] = 5] = "RECKLESS_OFFENCE";
    EventReason[EventReason["OFF_THE_BALL_FOUL"] = 6] = "OFF_THE_BALL_FOUL";
    EventReason[EventReason["PERSISTENT_FOULING"] = 7] = "PERSISTENT_FOULING";
    EventReason[EventReason["PERSISTENT_INFRINGEMENT"] = 8] = "PERSISTENT_INFRINGEMENT";
    EventReason[EventReason["VIOLENT_CONDUCT"] = 9] = "VIOLENT_CONDUCT";
    EventReason[EventReason["DANGEROUS_PLAY"] = 10] = "DANGEROUS_PLAY";
    EventReason[EventReason["HANDBALL"] = 11] = "HANDBALL";
    EventReason[EventReason["SERIOUS_FOUL"] = 12] = "SERIOUS_FOUL";
    EventReason[EventReason["PROFESSIONAL_FOUL_LAST_MAN"] = 13] = "PROFESSIONAL_FOUL_LAST_MAN";
    EventReason[EventReason["DENIED_GOAL_SCORING"] = 14] = "DENIED_GOAL_SCORING";
    EventReason[EventReason["TIME_WASTING"] = 15] = "TIME_WASTING";
    EventReason[EventReason["VIDEO_SYNC_DONE"] = 16] = "VIDEO_SYNC_DONE";
    EventReason[EventReason["RESCINDED_CARD"] = 17] = "RESCINDED_CARD";
    EventReason[EventReason["ARGUMENT"] = 18] = "ARGUMENT";
    EventReason[EventReason["DISSENT"] = 19] = "DISSENT";
    EventReason[EventReason["FOUL_ABUSIVE_LANGUAGE"] = 20] = "FOUL_ABUSIVE_LANGUAGE";
    EventReason[EventReason["EXCESSIVE_CELEBRATION"] = 21] = "EXCESSIVE_CELEBRATION";
    EventReason[EventReason["NOT_RETREATING"] = 22] = "NOT_RETREATING";
    EventReason[EventReason["FIGHT"] = 23] = "FIGHT";
    EventReason[EventReason["EXTRA_FLAG_TO_CHECKER"] = 24] = "EXTRA_FLAG_TO_CHECKER";
    EventReason[EventReason["ON_BENCH"] = 25] = "ON_BENCH";
    EventReason[EventReason["POST_MATCH"] = 26] = "POST_MATCH";
    EventReason[EventReason["OTHER_REASON"] = 27] = "OTHER_REASON";
    EventReason[EventReason["UNALLOWED_FIELD_ENTERING"] = 28] = "UNALLOWED_FIELD_ENTERING";
    EventReason[EventReason["ENTERING_FIELD"] = 29] = "ENTERING_FIELD";
    EventReason[EventReason["LEAVING_FIELD"] = 30] = "LEAVING_FIELD";
    EventReason[EventReason["UNSPORTING_BEHAVIOUR"] = 31] = "UNSPORTING_BEHAVIOUR";
    EventReason[EventReason["NOT_VISIBLE"] = 32] = "NOT_VISIBLE";
    EventReason[EventReason["FLOP"] = 33] = "FLOP";
    EventReason[EventReason["EXCESSIVE_REVIEW_SIGNAL"] = 34] = "EXCESSIVE_REVIEW_SIGNAL";
    EventReason[EventReason["ENTERING_REFEREE_REVIEW"] = 35] = "ENTERING_REFEREE_REVIEW";
    EventReason[EventReason["SPITTING"] = 36] = "SPITTING";
    EventReason[EventReason["VIRAL"] = 37] = "VIRAL"; // Viral
})(EventReason || (exports.EventReason = EventReason = {}));

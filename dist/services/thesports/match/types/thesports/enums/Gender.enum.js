"use strict";
/**
 * Gender Enum
 *
 * Represents gender for competitions, players, teams
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Gender = void 0;
exports.getGenderName = getGenderName;
var Gender;
(function (Gender) {
    Gender[Gender["MALE"] = 1] = "MALE";
    Gender[Gender["FEMALE"] = 2] = "FEMALE"; // Female (Kadın)
})(Gender || (exports.Gender = Gender = {}));
/**
 * Get gender display name
 */
function getGenderName(gender, lang = 'en') {
    const names = {
        [Gender.MALE]: { en: 'Male', tr: 'Erkek' },
        [Gender.FEMALE]: { en: 'Female', tr: 'Kadın' }
    };
    return names[gender]?.[lang] || 'Unknown';
}

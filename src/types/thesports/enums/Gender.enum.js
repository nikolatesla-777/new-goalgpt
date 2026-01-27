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
function getGenderName(gender, lang) {
    var _a;
    var _b;
    if (lang === void 0) { lang = 'en'; }
    var names = (_a = {},
        _a[Gender.MALE] = { en: 'Male', tr: 'Erkek' },
        _a[Gender.FEMALE] = { en: 'Female', tr: 'Kadın' },
        _a);
    return ((_b = names[gender]) === null || _b === void 0 ? void 0 : _b[lang]) || 'Unknown';
}

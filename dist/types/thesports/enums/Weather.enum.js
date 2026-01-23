"use strict";
/**
 * Weather Enum
 *
 * Represents weather conditions for matches (1-13)
 * Used in match.environment.weather field
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Weather = void 0;
exports.getWeatherName = getWeatherName;
exports.getWeatherEmoji = getWeatherEmoji;
exports.isRainyWeather = isRainyWeather;
exports.isBadWeather = isBadWeather;
var Weather;
(function (Weather) {
    Weather[Weather["PARTIALLY_CLOUDY"] = 1] = "PARTIALLY_CLOUDY";
    Weather[Weather["CLOUDY"] = 2] = "CLOUDY";
    Weather[Weather["PARTIALLY_CLOUDY_RAIN"] = 3] = "PARTIALLY_CLOUDY_RAIN";
    Weather[Weather["SNOW"] = 4] = "SNOW";
    Weather[Weather["SUNNY"] = 5] = "SUNNY";
    Weather[Weather["OVERCAST_THUNDERSTORM"] = 6] = "OVERCAST_THUNDERSTORM";
    Weather[Weather["OVERCAST"] = 7] = "OVERCAST";
    Weather[Weather["MIST"] = 8] = "MIST";
    Weather[Weather["OVERCAST_RAIN"] = 9] = "OVERCAST_RAIN";
    Weather[Weather["CLOUDY_RAIN"] = 10] = "CLOUDY_RAIN";
    Weather[Weather["CLOUDY_THUNDERSTORM"] = 11] = "CLOUDY_THUNDERSTORM";
    Weather[Weather["LOCAL_THUNDERSTORM"] = 12] = "LOCAL_THUNDERSTORM";
    Weather[Weather["FOG"] = 13] = "FOG"; // Sis
})(Weather || (exports.Weather = Weather = {}));
/**
 * Get weather display name
 */
function getWeatherName(weather, lang = 'en') {
    const names = {
        [Weather.PARTIALLY_CLOUDY]: { en: 'Partially Cloudy', tr: 'Parçalı Bulutlu' },
        [Weather.CLOUDY]: { en: 'Cloudy', tr: 'Bulutlu' },
        [Weather.PARTIALLY_CLOUDY_RAIN]: { en: 'Partially Cloudy/Rain', tr: 'Parçalı Bulutlu/Yağmur' },
        [Weather.SNOW]: { en: 'Snow', tr: 'Kar' },
        [Weather.SUNNY]: { en: 'Sunny', tr: 'Güneşli' },
        [Weather.OVERCAST_THUNDERSTORM]: { en: 'Overcast Rain/Thunderstorm', tr: 'Kapalı Yağmur/Fırtına' },
        [Weather.OVERCAST]: { en: 'Overcast', tr: 'Kapalı' },
        [Weather.MIST]: { en: 'Mist', tr: 'Puslu' },
        [Weather.OVERCAST_RAIN]: { en: 'Overcast with Rain', tr: 'Kapalı Yağmurlu' },
        [Weather.CLOUDY_RAIN]: { en: 'Cloudy with Rain', tr: 'Bulutlu Yağmurlu' },
        [Weather.CLOUDY_THUNDERSTORM]: { en: 'Cloudy with Thunderstorms', tr: 'Bulutlu Fırtınalı' },
        [Weather.LOCAL_THUNDERSTORM]: { en: 'Local Thunderstorms', tr: 'Yerel Fırtına' },
        [Weather.FOG]: { en: 'Fog', tr: 'Sis' }
    };
    return names[weather]?.[lang] || 'Unknown';
}
/**
 * Get weather emoji for UI
 */
function getWeatherEmoji(weather) {
    const emojis = {
        [Weather.PARTIALLY_CLOUDY]: '⛅',
        [Weather.CLOUDY]: '☁️',
        [Weather.PARTIALLY_CLOUDY_RAIN]: '🌦️',
        [Weather.SNOW]: '❄️',
        [Weather.SUNNY]: '☀️',
        [Weather.OVERCAST_THUNDERSTORM]: '⛈️',
        [Weather.OVERCAST]: '☁️',
        [Weather.MIST]: '🌫️',
        [Weather.OVERCAST_RAIN]: '🌧️',
        [Weather.CLOUDY_RAIN]: '🌧️',
        [Weather.CLOUDY_THUNDERSTORM]: '⛈️',
        [Weather.LOCAL_THUNDERSTORM]: '🌩️',
        [Weather.FOG]: '🌫️'
    };
    return emojis[weather] || '❓';
}
/**
 * Check if weather is rainy
 */
function isRainyWeather(weather) {
    return [
        Weather.PARTIALLY_CLOUDY_RAIN,
        Weather.OVERCAST_THUNDERSTORM,
        Weather.OVERCAST_RAIN,
        Weather.CLOUDY_RAIN,
        Weather.CLOUDY_THUNDERSTORM,
        Weather.LOCAL_THUNDERSTORM
    ].includes(weather);
}
/**
 * Check if weather might affect play
 */
function isBadWeather(weather) {
    return [
        Weather.SNOW,
        Weather.OVERCAST_THUNDERSTORM,
        Weather.CLOUDY_THUNDERSTORM,
        Weather.LOCAL_THUNDERSTORM,
        Weather.FOG
    ].includes(weather);
}

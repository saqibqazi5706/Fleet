"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyWeatherPenalty = applyWeatherPenalty;
function applyWeatherPenalty(ship, adverseWeather) {
    return { ...ship, inAdverseWeather: adverseWeather };
}
